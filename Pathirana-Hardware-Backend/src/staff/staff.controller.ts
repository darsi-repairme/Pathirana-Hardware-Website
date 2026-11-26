import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  GoneException,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { AuditService } from "../database/audit.service";
import { DatabaseService, type Queryable } from "../database/database.service";
import { AuthService, type AuthStaff } from "../auth/auth.service";
import { hashPassword, passwordProblem, PASSWORD_MAX } from "../auth/password";
import { RequirePermission, ROLES, type Role } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { StatusBody } from "../common/dto";

/** Set-up / reset links are valid for 24 hours and work once. */
const LINK_HOURS = 24;
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

class CreateStaffBody {
  @IsEmail({}, { message: "Enter a valid email address." }) @MaxLength(254) email!: string;
  @IsString() @MinLength(1, { message: "Enter the full name." }) @MaxLength(120) fullName!: string;
  @IsIn(ROLES) role!: Role;
  /** Optional: when omitted the account has no usable password until the set-up link is used. */
  @IsOptional() @IsString() @MaxLength(PASSWORD_MAX) password?: string;
}

class UpdateStaffBody {
  @IsOptional() @IsEmail({}, { message: "Enter a valid email address." }) @MaxLength(254) email?: string;
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "Enter the full name." })
  @MaxLength(120)
  fullName?: string;
}

class RoleBody {
  @IsIn(ROLES) role!: Role;
}

class PasswordBody {
  @IsString() @MaxLength(PASSWORD_MAX) password!: string;
}

class LinkBody {
  @IsIn(["setup", "reset"]) purpose!: "setup" | "reset";
}

class SetupBody {
  @IsString() @Matches(TOKEN, { message: "This link is not valid." }) token!: string;
  @IsString() @MaxLength(PASSWORD_MAX) password!: string;
}

class TokenQuery {
  @IsString() @Matches(TOKEN, { message: "This link is not valid." }) token!: string;
}

const COLUMNS = `id, email, full_name AS "fullName", role, is_active AS "isActive",
  last_login_at AS "lastLoginAt", created_at AS "createdAt",
  CASE WHEN photo_key IS NULL THEN NULL ELSE floor(extract(epoch FROM photo_updated_at) * 1000)::bigint::text END AS "photoVersion"`;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Refuses a change that would leave no active admin (the shop must never be locked out). */
async function assertAnotherActiveAdmin(db: Queryable, staffId: string) {
  const r = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM staff WHERE role = 'admin' AND is_active AND id <> $1",
    [staffId],
  );
  if (!r.rows[0]?.n) {
    throw new BadRequestException(
      "This is the only active admin. Add and verify another admin account before changing this one.",
    );
  }
}

/** Staff accounts (admins only). Passwords, hashes and stored token hashes are never returned. */
@Controller("admin/staff")
@UseGuards(StaffAuthGuard)
@RequirePermission("staff:manage")
export class StaffController {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list() {
    return this.db.query(
      `SELECT ${COLUMNS},
              (password_set_pending) AS "setupLinkPending"
         FROM (SELECT s.*, EXISTS (SELECT 1 FROM staff_password_tokens t
                                    WHERE t.staff_id = s.id AND t.used_at IS NULL AND t.expires_at > now()) AS password_set_pending
                 FROM staff s) x
        ORDER BY created_at`,
    );
  }

  @Post()
  async create(@Body() body: CreateStaffBody, @CurrentStaff() me: AuthStaff) {
    if (body.password !== undefined) {
      const problem = passwordProblem(body.password);
      if (problem) throw new BadRequestException(problem);
    }
    // Without a password the stored hash is of 32 random bytes nobody knows: sign-in is
    // impossible until the person sets their own password with a one-time link.
    const secret = body.password ?? randomBytes(32).toString("hex");
    try {
      const row = await this.db.one<{ id: string }>(
        `INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
        [body.email.trim().toLowerCase(), body.fullName.trim(), body.role, await hashPassword(secret)],
      );
      await this.audit.log(me.id, "staff.create", "staff", row!.id, {
        role: body.role,
        passwordSetBy: body.password ? "admin" : "link",
      });
      return row;
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException("A staff account with this email already exists.");
      throw e;
    }
  }

  /** Name / email corrections. An email change signs the account out everywhere. */
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateStaffBody,
    @CurrentStaff() me: AuthStaff,
  ) {
    if (body.email === undefined && body.fullName === undefined)
      throw new BadRequestException("Nothing to update.");
    const email = body.email?.trim().toLowerCase();
    try {
      const row = await this.db.one<{ id: string }>(
        `UPDATE staff SET email = COALESCE($2, email), full_name = COALESCE($3, full_name),
                token_version = token_version + CASE WHEN $2::text IS NOT NULL AND $2 <> email THEN 1 ELSE 0 END
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, email ?? null, body.fullName?.trim() ?? null],
      );
      if (!row) throw new NotFoundException("Staff member not found.");
      await this.audit.log(me.id, "staff.update", "staff", id, {
        changed: [...(email ? ["email"] : []), ...(body.fullName ? ["fullName"] : [])],
      });
      return row;
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException("A staff account with this email already exists.");
      throw e;
    }
  }

  /** Deactivating also signs the account out everywhere; the last active admin is protected. */
  @Patch(":id/status")
  async setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: StatusBody,
    @CurrentStaff() me: AuthStaff,
  ) {
    if (id === me.id && !body.isActive)
      throw new BadRequestException("You cannot deactivate your own account.");
    const row = await this.db.tx(async (client) => {
      const cur = await client.query<{ role: Role }>("SELECT role FROM staff WHERE id = $1 FOR UPDATE", [id]);
      if (!cur.rowCount) throw new NotFoundException("Staff member not found.");
      if (!body.isActive && cur.rows[0]!.role === "admin") await assertAnotherActiveAdmin(client, id);
      const r = await client.query<{ id: string }>(
        `UPDATE staff SET is_active = $2,
                token_version = token_version + CASE WHEN $2 THEN 0 ELSE 1 END
          WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, body.isActive],
      );
      // Deactivation also voids any unused set-up / reset link.
      if (!body.isActive)
        await client.query(
          "UPDATE staff_password_tokens SET used_at = now() WHERE staff_id = $1 AND used_at IS NULL",
          [id],
        );
      await this.audit.log(
        me.id,
        body.isActive ? "staff.activate" : "staff.deactivate",
        "staff",
        id,
        {},
        client,
      );
      return r.rows[0];
    });
    return row;
  }

  /** Changes a role; the account is signed out everywhere so the new role applies at once. */
  @Patch(":id/role")
  async setRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RoleBody,
    @CurrentStaff() me: AuthStaff,
  ) {
    if (id === me.id) throw new BadRequestException("You cannot change your own role.");
    return this.db.tx(async (client) => {
      const cur = await client.query<{ role: Role; is_active: boolean }>(
        "SELECT role, is_active FROM staff WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!cur.rowCount) throw new NotFoundException("Staff member not found.");
      if (cur.rows[0]!.role === "admin" && body.role !== "admin" && cur.rows[0]!.is_active)
        await assertAnotherActiveAdmin(client, id);
      const r = await client.query(
        `UPDATE staff SET role = $2, token_version = token_version + 1 WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, body.role],
      );
      await this.audit.log(me.id, "staff.role", "staff", id, { role: body.role }, client);
      return r.rows[0];
    });
  }

  /**
   * Creates a ONE-TIME password set-up (new account) or reset link, valid for 24 hours.
   * Only a SHA-256 hash is stored; the token is returned once, to the admin, to pass on
   * privately. Any earlier unused link for this person stops working.
   */
  @Post(":id/password-link")
  @HttpCode(201)
  async passwordLink(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: LinkBody,
    @CurrentStaff() me: AuthStaff,
  ) {
    const token = randomBytes(32).toString("base64url");
    const result = await this.db.tx(async (client) => {
      const s = await client.query<{ is_active: boolean }>(
        "SELECT is_active FROM staff WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!s.rowCount) throw new NotFoundException("Staff member not found.");
      if (!s.rows[0]!.is_active)
        throw new BadRequestException("Reactivate this account before sending a link.");
      await client.query(
        "UPDATE staff_password_tokens SET used_at = now() WHERE staff_id = $1 AND used_at IS NULL",
        [id],
      );
      const r = await client.query<{ expiresAt: string }>(
        `INSERT INTO staff_password_tokens (staff_id, token_hash, purpose, expires_at, created_by)
         VALUES ($1, $2, $3, now() + make_interval(hours => $4), $5) RETURNING expires_at AS "expiresAt"`,
        [id, sha256(token), body.purpose, LINK_HOURS, me.id],
      );
      await this.audit.log(me.id, `staff.password-link.${body.purpose}`, "staff", id, {}, client);
      return r.rows[0]!;
    });
    return { token, purpose: body.purpose, expiresAt: result.expiresAt };
  }

  /**
   * Sets a new password chosen by an admin (kept for emergencies; the one-time link is the
   * normal way). Clears any lockout and signs the account out everywhere.
   */
  @Patch(":id/password")
  async setPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: PasswordBody,
    @CurrentStaff() me: AuthStaff,
  ) {
    const problem = passwordProblem(body.password);
    if (problem) throw new BadRequestException(problem);
    const row = await this.db.one<{ id: string }>(
      `UPDATE staff SET password_hash = $2, token_version = token_version + 1,
              failed_login_count = 0, locked_until = NULL
        WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, await hashPassword(body.password)],
    );
    if (!row) throw new NotFoundException("Staff member not found.");
    this.auth.clearSignInFailures((row as { email?: string }).email ?? "");
    await this.audit.log(me.id, "staff.password-reset", "staff", id);
    return row;
  }
}

/** Public: the person opening a set-up / reset link (no session; the token IS the proof). */
@Controller("auth/password-setup")
export class PasswordSetupController {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  private async find(client: Queryable, token: string, lock = false) {
    const r = await client.query<{
      id: string;
      staff_id: string;
      purpose: "setup" | "reset";
      used_at: Date | null;
      expires_at: Date;
      full_name: string;
      is_active: boolean;
    }>(
      `SELECT t.id, t.staff_id, t.purpose, t.used_at, t.expires_at, s.full_name, s.is_active
         FROM staff_password_tokens t JOIN staff s ON s.id = t.staff_id
        WHERE t.token_hash = $1 ${lock ? "FOR UPDATE OF t" : ""}`,
      [sha256(token)],
    );
    const t = r.rows[0];
    // One message for unknown, used, expired and deactivated: nothing is revealed.
    if (!t || t.used_at || t.expires_at.getTime() <= Date.now() || !t.is_active)
      throw new GoneException("This link has expired or has already been used. Ask an admin for a new link.");
    return t;
  }

  /** Lets the page greet the person and say what the link is for (no email or role is revealed). */
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async check(@Query() q: TokenQuery) {
    const t = await this.find(this.db.pool, q.token);
    return { fullName: t.full_name, purpose: t.purpose, expiresAt: t.expires_at };
  }

  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async complete(@Body() body: SetupBody) {
    const problem = passwordProblem(body.password);
    if (problem) throw new BadRequestException(problem);
    const hash = await hashPassword(body.password);
    const email = await this.db.tx(async (client) => {
      const t = await this.find(client, body.token, true);
      const updated = await client.query<{ email: string }>(
        `UPDATE staff SET password_hash = $2, token_version = token_version + 1,
                failed_login_count = 0, locked_until = NULL WHERE id = $1 RETURNING email`,
        [t.staff_id, hash],
      );
      // Single use: this link and any other unused link for the person stop working.
      await client.query(
        "UPDATE staff_password_tokens SET used_at = now() WHERE staff_id = $1 AND used_at IS NULL",
        [t.staff_id],
      );
      await this.audit.log(
        t.staff_id,
        `staff.password-${t.purpose}.complete`,
        "staff",
        t.staff_id,
        {},
        client,
      );
      return updated.rows[0]?.email ?? "";
    });
    // The new password also lifts any sign-in blocks for this account.
    this.auth.clearSignInFailures(email);
  }
}
