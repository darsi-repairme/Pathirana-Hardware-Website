import { NextResponse, type NextRequest } from "next/server";
import { backendFetch } from "@/lib/server/backend";
import { DEVICE_COOKIE, requestClient } from "@/lib/server/client-identity";
import { config, SESSION_COOKIE } from "@/lib/server/config";

/**
 * GET /api/session/expired — shows the sign-in page after a session ended (used by the admin layout
 * and the browser API client when the API rejects the session).
 *
 * The session cookie is cleared ONLY when all of these hold, so this link cannot be used to sign
 * staff out from another website (a link, image or redirect on a foreign page):
 * 1. the navigation comes from this site, or was typed/bookmarked (Sec-Fetch-Site same-origin/none);
 * 2. the request carries a session cookie; and
 * 3. the API confirms that session is no longer valid (401/403).
 * A valid session is kept and the person continues to the page they wanted; if the API cannot be
 * reached the session is kept as well (a short outage never signs staff out).
 */
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next");
  const safeNext = next && /^\/[a-z0-9/-]*$/i.test(next) && !next.startsWith("//") ? next : null;
  // Relative redirects: stay on the host the person is using (req.url can name the bind address).
  const redirect = (location: string) => new NextResponse(null, { status: 307, headers: { Location: location } });
  const toLogin = () => redirect(`/login?expired=1${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`);

  const site = req.headers.get("sec-fetch-site");
  const fromThisSite = site === null || site === "same-origin" || site === "none";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  // Foreign navigation, or nothing to clear: no state change at all.
  if (!fromThisSite || !token) return toLogin();

  let status: number;
  try {
    const res = await backendFetch("/api/v1/auth/me", {
      token,
      client: requestClient(req.headers, req.cookies.get(DEVICE_COOKIE)?.value),
    });
    status = res.status;
  } catch {
    status = 0;
  }
  if (status !== 401 && status !== 403) {
    // Still signed in (or the API is unreachable): keep the session, continue to the page.
    return redirect(safeNext ?? "/dashboard");
  }

  const out = toLogin();
  out.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: 0,
  });
  return out;
}
