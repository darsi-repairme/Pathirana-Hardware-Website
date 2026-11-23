import { NextResponse, type NextRequest } from "next/server";

/**
 * First gate: admin pages need a session cookie, otherwise → /login. This
 * only checks presence; the (admin) layout validates the session with the
 * API on every page load, and the API enforces permissions on every call.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.get("ph_admin_session")?.value) {
    // Tell the layout which page was requested (to return there after re-sign-in).
    const headers = new Headers(req.headers);
    headers.set("x-ph-path", req.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  }
  const url = new URL("/login", req.url);
  const { pathname } = req.nextUrl;
  if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Admin pages only: not the login page, API routes, Next assets or public files.
  matcher: ["/((?!login|setup-password|api/|_next/|brand/|brands/|favicon.ico|icon.png).*)"],
};
