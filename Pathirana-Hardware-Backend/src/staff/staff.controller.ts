import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { AuditService } from "../database/audit.service";
import { DatabaseService } from "../database/database.service";
import type { AuthStaff } from "../auth/auth.service";
import { hashPassword, passwordProblem, PASSWORD_MAX } from "../auth/password";
import { RequirePermission, ROLES, type Role } from "../auth/roles";
import { CurrentStaff, StaffAuthGuard } from "../auth/staff-auth.guard";
import { StatusBody } from "../common/dto";

class CreateStaffBody {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(120) fullName!: string;
  @IsIn(ROLES) role!: Role;
  @IsString() @MaxLength(PASSWORD_MAX) password!: string;
}

class RoleBody {
  @IsIn(ROLES) role!: Role;
}

class PasswordBody {
  @IsString() @MaxLength(PASSWORD_MAX) password!: string;
}

const COLUMNS = `id, email, full_name AS "fullName", role, is_active AS "isActive",
  last_login_at AS "lastLoginAt", created_at AS "createdAt"`;

/** Staff accounts (admins only). Passwords and hashes are never returned. */
@Controller("admin/staff")
@UseGuards(StaffAuthGuard)
@RequirePermission("staff:manage")
export class StaffController {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.db.query(`SELECT ${COLUMNS} FROM staff ORDER BY created_at`);
  }

  @Post()
  async create(@Body() body: CreateStaffBody, @CurrentStaff() me: AuthStaff) {
    const problem = passwordProblem(body.password);
    if (problem) throw new BadRequestException(problem);
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO staff (email, full_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [body.email.trim().toLowerCase(), body.fullName.trim(), body.role, await hashPassword(body.password)],
    );
    await this.audit.log(me.id, "staff.create", "staff", row!.id, { role: body.role });
    return row;
  }

  /** Deactivating also signs the account out everywhere. */
  @Patch(":id/status")
  async setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: StatusBody,
    @CurrentStaff() me: AuthStaff,
  ) {
    if (id === me.id && !body.isActive)
      throw new BadRequestException("You cannot deactivate your own account.");
    const row = await this.db.one<{ id: string }>(
      `UPDATE staff SET is_active = $2,
              token_version = token_version + CASE WHEN $2 THEN 0 ELSE 1 END
        WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, body.isActive],
    );
    if (!row) throw new NotFoundException("Staff member not found.");
    await this.audit.log(me.id, body.isActive ? "staff.activate" : "staff.deactivate", "staff", id);
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
    const row = await this.db.one<{ id: string }>(
      `UPDATE staff SET role = $2, token_version = token_version + 1 WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, body.role],
    );
    if (!row) throw new NotFoundException("Staff member not found.");
    await this.audit.log(me.id, "staff.role", "staff", id, { role: body.role });
    return row;
  }

  /**
   * Sets a new password chosen by an admin (e.g. a forgotten password). Clears
   * any lockout and signs the account out everywhere. The password is never
   * logged or returned.
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
    await this.audit.log(me.id, "staff.password-reset", "staff", id);
    return row;
  }
}
