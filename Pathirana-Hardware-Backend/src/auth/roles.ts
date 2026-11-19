import { SetMetadata } from "@nestjs/common";

export type Role = "admin" | "editor";
export const ROLES: readonly Role[] = ["admin", "editor"];

/** Role-based authorisation foundation: each permission lists the roles holding it. */
export const PERMISSIONS = {
  "catalogue:write": ["admin", "editor"],
  "delivery-areas:write": ["admin", "editor"],
  "staff:manage": ["admin"],
  /** Customer quotation requests (personal data): shop staff who answer customers. */
  "quotations:manage": ["admin", "editor"],
  /** Permanent product deletion (unpublishing is the routine action). */
  "products:delete": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleHas(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const PERMISSION_KEY = "permission";
/** Requires a signed-in, active staff member holding `permission`. */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
