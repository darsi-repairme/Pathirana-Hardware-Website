import { SetMetadata } from "@nestjs/common";

export type Role = "admin" | "editor";
export const ROLES: readonly Role[] = ["admin", "editor"];

/** Role-based authorisation foundation: each permission lists the roles holding it. */
export const PERMISSIONS = {
  "catalogue:write": ["admin", "editor"],
  "delivery-areas:write": ["admin", "editor"],
  /** Bringing an archived area back (archiving is the "safe delete"; undoing it is admin-only). */
  "delivery-areas:restore": ["admin"],
  "staff:manage": ["admin"],
  /** Reading the audit log (dashboard Recent Activity and the Audit Log page). Logging never stops. */
  "audit:view": ["admin"],
  /** Customer quotation requests (personal data): shop staff who answer customers. */
  "quotations:manage": ["admin", "editor"],
  /** Services shown on the website (text, order, publish/hide, image). */
  "services:write": ["admin", "editor"],
  /** Gallery photos on the website (upload, describe, order, publish/hide, delete). */
  "gallery:write": ["admin", "editor"],
  /** Customer feedback: approving, rejecting and hiding submissions before / after publication. */
  "feedback:moderate": ["admin", "editor"],
  /** Republishing feedback that was hidden. */
  "feedback:restore": ["admin"],
  /** Offers & promo codes: preparing and editing drafts. */
  "offers:write": ["admin", "editor"],
  /** Publishing / hiding offers, and changing a PUBLISHED offer's code, discount or dates. */
  "offers:publish": ["admin"],
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
