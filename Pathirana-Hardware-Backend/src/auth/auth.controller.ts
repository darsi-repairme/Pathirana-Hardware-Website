import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import type { Request } from "express";
import { clientSourceOf, loginTracker } from "../common/client-identity";
import { AuthService, type AuthStaff } from "./auth.service";
import { SignInSourceLimit } from "./sign-in-limits";
import { CurrentStaff, StaffAuthGuard } from "./staff-auth.guard";

class ChangePasswordBody {
  @IsString() @MinLength(1) @MaxLength(128) currentPassword!: string;
  @IsString() @MaxLength(128) newPassword!: string;
}

class LoginBody {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * 5 attempts per minute per client source and email, at most 60 per minute per client source
   * (all emails), on top of the failure limits in AuthService. Keyed by email too, so a client
   * hammering one address does not block sign-ins to other accounts from a shared address.
   */
  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000, getTracker: loginTracker } })
  @SignInSourceLimit()
  login(@Body() body: LoginBody, @Req() req: Request) {
    return this.auth.login(body.email, body.password, clientSourceOf(req));
  }

  @Get("me")
  @UseGuards(StaffAuthGuard)
  me(@CurrentStaff() staff: AuthStaff) {
    return staff;
  }

  /**
   * Changes the signed-in staff member's own password (current password
   * required). All existing sessions end, so the user signs in again.
   */
  @Post("password")
  @HttpCode(204)
  @UseGuards(StaffAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(@CurrentStaff() staff: AuthStaff, @Body() body: ChangePasswordBody) {
    await this.auth.changePassword(staff.id, body.currentPassword, body.newPassword);
  }

  /** Invalidates every token issued to this staff member. */
  @Post("logout")
  @HttpCode(204)
  @UseGuards(StaffAuthGuard)
  async logout(@CurrentStaff() staff: AuthStaff) {
    await this.auth.logout(staff.id);
  }
}
