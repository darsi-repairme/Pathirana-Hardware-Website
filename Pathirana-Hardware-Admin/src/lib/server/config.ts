import "server-only";

/** Server-only configuration (never exposed to the browser). */
function backendUrl(): string {
  const raw = process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000";
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("BACKEND_API_URL must be http(s)");
  return u.origin;
}

export const config = {
  backendUrl: backendUrl(),
  /** Seconds; keep equal to the API's JWT_EXPIRES_IN. */
  sessionMaxAge: Math.max(300, Number(process.env.ADMIN_SESSION_MAX_AGE) || 8 * 60 * 60),
  cookieSecure: process.env.ADMIN_COOKIE_SECURE === "true",
  /** Behind a trusted reverse proxy (forward the client IP so the API can rate-limit per device). */
  trustProxy: process.env.ADMIN_TRUST_PROXY === "true",
};

export const SESSION_COOKIE = "ph_admin_session";
/** Header the browser must send on state-changing requests (CSRF defence with SameSite=Strict + Origin check). */
export const CSRF_HEADER = "x-ph-admin";
