import { NextResponse, type NextRequest } from "next/server";
import { backendFetch } from "@/lib/server/backend";
import { DEVICE_COOKIE, requestClient, type RequestClient } from "@/lib/server/client-identity";
import { config, CSRF_HEADER, SESSION_COOKIE } from "@/lib/server/config";
import { sameOrigin } from "@/lib/server/csrf";

/**
 * Same-origin gateway from the admin UI to the API (/api/backend/<path> →
 * API /api/v1/<path>). It attaches the staff token from the HttpOnly cookie,
 * so page scripts never see it. Only the staff endpoints are reachable;
 * permissions are still enforced by the API on every call.
 */
const ALLOWED = /^(admin\/[a-z0-9-]+(\/[A-Za-z0-9-]+)*|auth\/me|auth\/password)$/;
const PASS_HEADERS = ["content-type", "content-length", "cache-control", "x-request-id"];

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join("/");
  if (!ALLOWED.test(path)) return NextResponse.json({ message: "Not found." }, { status: 404 });

  const mutating = req.method !== "GET" && req.method !== "HEAD";
  if (mutating && (!sameOrigin(req) || req.headers.get(CSRF_HEADER) !== "1")) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Your session has ended. Please sign in again." }, { status: 401 });

  const headers = new Headers();
  const type = req.headers.get("content-type");
  if (type) headers.set("Content-Type", type);
  const length = req.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  let res: Response;
  try {
    res = await backendFetch(`/api/v1/${path}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      token,
      client: requestClient(req.headers, req.cookies.get(DEVICE_COOKIE)?.value),
      // Stream request bodies (image uploads) straight through.
      ...(mutating ? { body: req.body, duplex: "half" } : {}),
    } as RequestInit & { token: string; client?: RequestClient; duplex?: "half" });
  } catch {
    return NextResponse.json({ message: "The server is unavailable. Please try again." }, { status: 503 });
  }

  const out = new NextResponse(res.status === 204 ? null : res.body, { status: res.status });
  for (const h of PASS_HEADERS) {
    const v = res.headers.get(h);
    if (v && !(h === "content-length" && res.status === 204)) out.headers.set(h, v);
  }
  if (!out.headers.has("cache-control")) out.headers.set("Cache-Control", "no-store");
  // Session revoked or expired on the API: drop the cookie too.
  if (res.status === 401) {
    out.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: config.cookieSecure,
      path: "/",
      maxAge: 0,
    });
  }
  return out;
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
