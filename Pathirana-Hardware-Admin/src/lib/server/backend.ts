import "server-only";
import { cookies } from "next/headers";
import { config, SESSION_COOKIE } from "./config";

export type StaffRole = "admin" | "editor";
export type Staff = { id: string; email: string; fullName: string; role: StaffRole };

/**
 * Client IP to forward to the API (for per-device rate limiting), or undefined.
 * Only when this app runs behind a trusted reverse proxy (ADMIN_TRUST_PROXY=true):
 * then the LAST X-Forwarded-For hop — the one that proxy appended — is used.
 * Earlier hops are client-supplied and could be forged, so they are ignored.
 */
export function clientIp(headers: Headers): string | undefined {
  if (!config.trustProxy) return undefined;
  const hops =
    headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((h) => h.trim())
      .filter(Boolean) ?? [];
  const ip = hops[hops.length - 1] ?? headers.get("x-real-ip") ?? undefined;
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : undefined;
}

/** Calls the API (server side), attaching the staff token when given. */
export function backendFetch(
  path: string,
  init: RequestInit & { token?: string; ip?: string } = {},
): Promise<Response> {
  const { token, ip, headers, ...rest } = init;
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  if (token) h.set("Authorization", `Bearer ${token}`);
  // Lets the API rate-limit per staff device rather than per admin server
  // (the API must run with TRUST_PROXY=true behind this server).
  if (ip) h.set("X-Forwarded-For", ip);
  return fetch(`${config.backendUrl}${path}`, { ...rest, headers: h, cache: "no-store", redirect: "manual" });
}

/** The signed-in staff member for the current request, or null (checked against the API every time). */
export async function currentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await backendFetch("/api/v1/auth/me", { token });
    if (!res.ok) return null;
    return (await res.json()) as Staff;
  } catch {
    return null;
  }
}
