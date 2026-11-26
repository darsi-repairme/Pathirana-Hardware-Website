import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import type { Role } from "./roles";
import { SourceFailureLimiter } from "./sign-in-limits";

/** The signed-in staff member. `photoVersion` (profile photo cache key, migration 0010) is read in the
 *  same session-check query, so showing the avatar costs no extra database round trip. */
export type AuthStaff = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  photoVersion?: string | null;
};
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

/** Account-wide limit (all sources together): failures before the account is locked. */
export const ACCOUNT_MAX_FAILURES = 20;
export const LOCK_MINUTES = 15;
const INVALID = "Invalid email or password.";

/**
 * Staff sign-in. Tokens are short-lived JWTs carrying the staff member's
 * token_version; logout, deactivation or a role change bump the version, which
 * invalidates every token issued before it (checked on each request).
 *
 * Failed sign-ins are limited in two layers; the response never reveals whether an email exists,
 * which layer refused it, or whether an account is locked:
 * 1. Per client source and account (SourceFailureLimiter): 5 failures in 15 minutes block only
 *    that source for that account — a stranger guessing passwords cannot lock out the owner,
 *    who signs in from another source (e.g. a remembered device).
 * 2. Per account (database, atomic): ACCOUNT_MAX_FAILURES failures from any sources lock the
 *    account for LOCK_MINUTES — a cap on guesses spread over many sources.
 * Locks expire by themselves; setting a new password through an administrator's one-time
 * password link clears both layers at once.
 */
@Injectable()
export class AuthService {
  /** Hash verified when the email is unknown, so timing does not reveal accounts. */
  private dummyHash: Promise<string> | null = null;
  private readonly sourceFailures = new SourceFailureLimiter();

  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= hashPassword("not-a-real-password-for-timing");
    await verifyPassword(await this.dummyHash, password);
  }

  /** `source`: the caller's client identity (common/client-identity.ts). */
  async login(
    email: string,
    password: string,
    source = "unknown",
  ): Promise<{ accessToken: string; staff: AuthStaff }> {
    const account = email.trim().toLowerCase();
    // This source has used up its attempts for this account: refuse without checking the
    // password (same answer and similar timing as a wrong password).
    if (this.sourceFailures.isBlocked(source, account)) {
      await this.verifyDummy(password);
      throw new UnauthorizedException(INVALID);
    }
    const row = await this.db.one<StaffRow & { photo_version: string | null }>(
      `SELECT id, email, full_name, role, is_active, token_version, password_hash, failed_login_count, locked_until
         FROM staff WHERE email = $1`,
      [account],
    );
    if (!row) {
      await this.verifyDummy(password);
      this.sourceFailures.recordFailure(source, account);
      throw new UnauthorizedException(INVALID);
    }
    const locked = row.locked_until && row.locked_until.getTime() > Date.now();
    // The expensive Argon2id check runs outside any database lock.
    const ok = (await verifyPassword(row.password_hash, password)) && !locked && row.is_active;
    if (!ok) {
      if (!locked) {
        this.sourceFailures.recordFailure(source, account);
        await this.recordAccountFailure(row.id);
      }
      throw new UnauthorizedException(INVALID);
    }
    const signedIn = await this.db.query<{ id: string }>(
      `UPDATE staff SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
        WHERE id = $1 AND (locked_until IS NULL OR locked_until <= now()) RETURNING id`,
      [row.id],
    );
    // Locked by concurrent failures after the check above: refuse like any locked account.
    if (signedIn.length === 0) throw new UnauthorizedException(INVALID);
    this.sourceFailures.clear(source, account);
    const payload: TokenPayload = { sub: row.id, role: row.role, tv: row.token_version };
    return {
      accessToken: await this.jwt.signAsync(payload),
      staff: { id: row.id, email: row.email, fullName: row.full_name, role: row.role },
    };
  }

  /**
   * Counts one failed sign-in in a single atomic UPDATE (no read-modify-write): concurrent
   * failures queue on the row lock and each sees the previous one's count, so none is lost.
   * Reaching ACCOUNT_MAX_FAILURES locks the account in the same statement; an account that is
   * already locked is not counted (WHERE clause), so the lock is set exactly once.
   */
  private async recordAccountFailure(staffId: string): Promise<void> {
    const rows = await this.db.query<{ just_locked: boolean }>(
      `UPDATE staff
          SET failed_login_count = CASE WHEN failed_login_count + 1 >= $2 THEN 0 ELSE failed_login_count + 1 END,
              locked_until = CASE WHEN failed_login_count + 1 >= $2
                                  THEN now() + make_interval(mins => $3) ELSE locked_until END
        WHERE id = $1 AND (locked_until IS NULL OR locked_until <= now())
        RETURNING locked_until IS NOT NULL AND locked_until > now() AS just_locked`,
      [staffId, ACCOUNT_MAX_FAILURES, LOCK_MINUTES],
    );
    if (rows[0]?.just_locked) await this.audit.log(staffId, "auth.locked", "staff", staffId);
  }

  /** After an administrator-issued password reset: every source may try this account again. */
  clearSignInFailures(email: string): void {
    this.sourceFailures.clearAccount(email.trim().toLowerCase());
  }

  /** Verifies a bearer token against the current staff record. */
  async authenticate(token: string): Promise<AuthStaff> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Your session is invalid or has expired.");
    }
    const row = await this.db.one<StaffRow & { photo_version: string | null }>(
      `SELECT id, email, full_name, role, is_active, token_version,
              CASE WHEN photo_key IS NULL THEN NULL ELSE floor(extract(epoch FROM photo_updated_at) * 1000)::bigint::text END AS photo_version
         FROM staff WHERE id = $1`,
      [payload.sub],
    );
    if (!row || !row.is_active || row.token_version !== payload.tv) {
      throw new UnauthorizedException("Your session is invalid or has expired.");
    }
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      photoVersion: row.photo_version,
    };
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
