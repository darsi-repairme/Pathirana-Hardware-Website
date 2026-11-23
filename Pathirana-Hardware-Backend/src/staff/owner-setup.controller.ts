import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  GoneException,
  HttpCode,
  Inject,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { AuditService } from "../database/audit.service";
import { DatabaseService, type Queryable } from "../database/database.service";
import { hashPassword, passwordProblem, PASSWORD_MAX } from "../auth/password";
import { ENV, type Env } from "../config/env";
import { verifyOwnerCode } from "./owner-code";

class OwnerSetupBody {
  @IsString() @MinLength(1, { message: "Enter the verification code." }) @MaxLength(40) code!: string;
  @IsString() @MinLength(1, { message: "Enter your full name." }) @MaxLength(120) fullName!: string;
  @IsEmail({}, { message: "Enter a valid email address." }) @MaxLength(254) email!: string;
  @IsString() @MaxLength(PASSWORD_MAX) password!: string;
  @IsString() @MaxLength(PASSWORD_MAX) confirmPassword!: string;
}

/** Any session-wide lock number: serialises Owner registrations (only one can ever win). */
const OWNER_LOCK = 774_211_001;
const CLOSED = "Owner registration is closed. Sign in, or ask the owner for a staff account.";
const BAD_CODE = "This verification code is not valid or has expired.";

/**
 * Public, one-time Owner (first administrator) registration. It is open ONLY while no
 * administrator exists; the code from `npm run owner:code` (printed in the server's terminal)
 * proves the person is at the shop's server. The first success creates the administrator and
 * closes registration for good. No other public sign-up exists.
 */
@Controller("auth/owner-setup")
export class OwnerSetupController {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async open(q: Queryable): Promise<boolean> {
    const r = await q.query("SELECT 1 FROM staff WHERE role = 'admin' LIMIT 1");
    return r.rowCount === 0;
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async status() {
    return { open: await this.open(this.db.pool) };
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() body: OwnerSetupBody) {
    if (!(await this.open(this.db.pool))) throw new GoneException(CLOSED);
    if (!verifyOwnerCode(this.env.JWT_SECRET, body.code)) throw new BadRequestException(BAD_CODE);
    if (body.password !== body.confirmPassword) throw new BadRequestException("The passwords do not match.");
    const problem = passwordProblem(body.password);
    if (problem) throw new BadRequestException(problem);
    const email = body.email.trim().toLowerCase();
    const fullName = body.fullName.trim();
    if (!fullName) throw new BadRequestException("Enter your full name.");
    const hash = await hashPassword(body.password);

    return this.db.tx(async (client) => {
      // One registration at a time; re-checked under the lock so two simultaneous requests
      // with valid codes can never create two Owners.
      await client.query("SELECT pg_advisory_xact_lock($1)", [OWNER_LOCK]);
      if (!(await this.open(client))) throw new GoneException(CLOSED);
      let id: string;
      try {
        const r = await client.query<{ id: string }>(
          "INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, $2, 'admin', $3) RETURNING id",
          [email, fullName, hash],
        );
        id = r.rows[0]!.id;
      } catch (e) {
        if ((e as { code?: string }).code === "23505")
          throw new ConflictException("A staff account with this email already exists.");
        throw e;
      }
      await this.audit.log(id, "staff.create-owner", "staff", id, { via: "owner-setup" }, client);
      return { fullName, email };
    });
  }
}
