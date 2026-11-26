import "server-only";
import { cookies, headers } from "next/headers";
import { clientHeaders, DEVICE_COOKIE, requestClient, type RequestClient } from "./client-identity";
import { config, SESSION_COOKIE } from "./config";

export type StaffRole = "admin" | "editor";
export type Staff = { id: string; email: string; fullName: string; role: StaffRole; photoVersion?: string | null };

/**
 * Calls the API (server side), attaching the staff token when given, and the client identity
 * (lib/server/client-identity.ts) so the API rate-limits per staff device, not per Admin server.
 */
export function backendFetch(
  path: string,
  init: RequestInit & { token?: string; client?: RequestClient } = {},
): Promise<Response> {
  const { token, client, headers, ...rest } = init;
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  if (token) h.set("Authorization", `Bearer ${token}`);
  clientHeaders(client, h);
  return fetch(`${config.backendUrl}${path}`, { ...rest, headers: h, cache: "no-store", redirect: "manual" });
}

/** The API could not confirm the session right now (busy, rate-limited, down) — NOT a sign-out. */
export class SessionCheckUnavailable extends Error {}

/**
 * The signed-in staff member for the current request (checked against the API every time).
 * - null: no session, or the API rejected it (401/403) → sign in again.
 * - throws SessionCheckUnavailable: a temporary problem (429, 5xx, network); the session is kept,
 *   so a short API hiccup never signs staff out.
 * The visitor's address is forwarded (behind a trusted proxy), so each staff device has its own
 * rate-limit budget instead of every page load sharing the Admin server's.
 */
export async function currentStaff(): Promise<Staff | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let res: Response;
  try {
    res = await backendFetch("/api/v1/auth/me", {
      token,
      client: requestClient((await headers()) as unknown as Headers, jar.get(DEVICE_COOKIE)?.value),
    });
  } catch {
    throw new SessionCheckUnavailable("The server could not be reached.");
  }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new SessionCheckUnavailable(`Session check failed (${res.status}).`);
  return (await res.json()) as Staff;
}

/** For pages that only need a hint (e.g. the login page): temporary problems count as "not signed in". */
export async function currentStaffOrNull(): Promise<Staff | null> {
  try {
    return await currentStaff();
  } catch {
    return null;
  }
}
