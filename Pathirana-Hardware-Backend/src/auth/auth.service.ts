import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import type { Role } from "./roles";

export type AuthStaff = { id: string; email: string; fullName: string; role: Role };
type TokenPayload = { sub: string; role: Role; tv: number };
type StaffRow = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  token_version: number;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
};

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const INVALID = "Invalid email or password.";

/**
 * Staff sign-in. Tokens are short-lived JWTs carrying the staff member's
 * token_version; logout, deactivation or a role change bump the version, which
 * invalidates every token issued before it (checked on each request).
 * Failed sign-ins lock the account for 15 minutes after five attempts; the
 * response never reveals whether an email exists or is locked.
 */
@Injectable()
export class AuthService {
  /** Hash verified when the email is unknown, so timing does not reveal accounts. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; staff: AuthStaff }> {
    const row = await this.db.one<StaffRow>(
      `SELECT id, email, full_name, role, is_active, token_version, password_hash, failed_login_count, locked_until
         FROM staff WHERE email = $1`,
      [email.trim().toLowerCase()],
    );
    if (!row) {
      this.dummyHash ??= hashPassword("not-a-real-password-for-timing");
      await verifyPassword(await this.dummyHash, password);
      throw new UnauthorizedException(INVALID);
    }
    const locked = row.locked_until && row.locked_until.getTime() > Date.now();
    const ok = (await verifyPassword(row.password_hash, password)) && !locked && row.is_active;
    if (!ok) {
      if (!locked) {
        const failures = row.failed_login_count + 1;
        if (failures >= MAX_FAILURES) {
          await this.db.query(
            "UPDATE staff SET failed_login_count = 0, locked_until = now() + make_interval(mins => $2) WHERE id = $1",
            [row.id, LOCK_MINUTES],
          );
          await this.audit.log(row.id, "auth.locked", "staff", row.id);
        } else {
          await this.db.query("UPDATE staff SET failed_login_count = $2 WHERE id = $1", [row.id, failures]);
        }
      }
      throw new UnauthorizedException(INVALID);
    }
    await this.db.query(
      "UPDATE staff SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1",
      [row.id],
    );
    const payload: TokenPayload = { sub: row.id, role: row.role, tv: row.token_version };
    return {
      accessToken: await this.jwt.signAsync(payload),
      staff: { id: row.id, email: row.email, fullName: row.full_name, role: row.role },
    };
  }

  /** Verifies a bearer token against the current staff record. */
  async authenticate(token: string): Promise<AuthStaff> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Your session is invalid or has expired.");
    }
    const row = await this.db.one<StaffRow>(
      "SELECT id, email, full_name, role, is_active, token_version FROM staff WHERE id = $1",
      [payload.sub],
    );
    if (!row || !row.is_active || row.token_version !== payload.tv) {
      throw new UnauthorizedException("Your session is invalid or has expired.");
    }
    return { id: row.id, email: row.email, fullName: row.full_name, role: row.role };
  }

  /** Signs the staff member out everywhere (all earlier tokens become invalid). */
  async logout(staffId: string): Promise<void> {
    await this.db.query("UPDATE staff SET token_version = token_version + 1 WHERE id = $1", [staffId]);
    await this.audit.log(staffId, "auth.logout", "staff", staffId);
  }

  async changePassword(staffId: string, current: string, next: string): Promise<void> {
    const row = await this.db.one<{ password_hash: string }>(
      "SELECT password_hash FROM staff WHERE id = $1",
      [staffId],
    );
    if (!row || !(await verifyPassword(row.password_hash, current))) {
      throw new BadRequestException("The current password is incorrect.");
    }
    const problem = passwordProblem(next);
    if (problem) throw new BadRequestException(problem);
    if (current === next) throw new BadRequestException("Choose a password different from the current one.");
    await this.db.query(
      "UPDATE staff SET password_hash = $2, token_version = token_version + 1 WHERE id = $1",
      [staffId, await hashPassword(next)],
    );
    await this.audit.log(staffId, "auth.password-change", "staff", staffId);
  }
}
