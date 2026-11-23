import "server-only";
import type { NextRequest } from "next/server";

/**
 * Accepts a request only when the browser says it came from this same origin
 * (Origin header, falling back to Sec-Fetch-Site). Combined with the
 * SameSite=Strict session cookie and a required custom header on mutations,
 * this blocks cross-site request forgery.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = req.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}
