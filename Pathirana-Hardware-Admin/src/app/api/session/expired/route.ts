import { NextResponse, type NextRequest } from "next/server";
import { config, SESSION_COOKIE } from "@/lib/server/config";

/** Clears a stale session cookie (rejected by the API) and shows the sign-in page. */
export function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next");
  const url = new URL("/login", req.url);
  url.searchParams.set("expired", "1");
  if (next && /^\/[a-z0-9/-]*$/i.test(next) && !next.startsWith("//")) url.searchParams.set("next", next);
  const out = NextResponse.redirect(url);
  out.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: 0,
  });
  return out;
}
