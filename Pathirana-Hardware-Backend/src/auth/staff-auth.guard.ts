import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthService, type AuthStaff } from "./auth.service";
import { type Permission, PERMISSION_KEY, roleHas } from "./roles";

export type StaffRequest = Request & { staff?: AuthStaff };

/**
 * Protects staff endpoints: requires a valid bearer token for an active staff
 * member (token version checked against the database), then the permission
 * named by @RequirePermission on the handler or controller, if any.
 */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<StaffRequest>();
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) throw new UnauthorizedException("Sign in to continue.");
    req.staff = await this.auth.authenticate(token);

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (permission && !roleHas(req.staff.role, permission)) {
      throw new ForbiddenException("You do not have permission to do this.");
    }
    return true;
  }
}

/** The signed-in staff member (only on routes protected by StaffAuthGuard). */
export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthStaff => {
  const staff = ctx.switchToHttp().getRequest<StaffRequest>().staff;
  if (!staff) throw new UnauthorizedException();
  return staff;
});
