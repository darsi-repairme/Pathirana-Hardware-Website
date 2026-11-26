import { NextResponse, type NextRequest } from "next/server";
import { backendFetch } from "@/lib/server/backend";
import { DEVICE_COOKIE, rememberDevice, requestClient } from "@/lib/server/client-identity";
import { config, CSRF_HEADER, SESSION_COOKIE } from "@/lib/server/config";
import { sameOrigin } from "@/lib/server/csrf";

/**
 * POST /api/session — sign in. The API's JWT is stored only in an HttpOnly,
 * SameSite=Strict cookie (never readable by page scripts); the response body
 * carries the staff profile only.
 * DELETE /api/session — sign out: revokes every token on the API, clears the cookie.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ message: "Enter your email and password." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await backendFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      client: requestClient(req.headers, req.cookies.get(DEVICE_COOKIE)?.value),
    });
  } catch {
    return NextResponse.json({ message: "The server is unavailable. Please try again shortly." }, { status: 503 });
  }

  if (res.status === 429) {
    return NextResponse.json({ message: "Too many sign-in attempts. Wait a minute and try again." }, { status: 429 });
  }
  if (res.status === 400) {
    return NextResponse.json({ message: "Enter a valid email address and password." }, { status: 400 });
  }
  // API/database failure: still no sign-in, but say so instead of "incorrect password".
  if (res.status >= 500) {
    return NextResponse.json({ message: "The server is unavailable. Please try again shortly." }, { status: 503 });
  }
  if (!res.ok) {
    // Same message for wrong password, unknown email or a locked account (the API does not reveal which).
    return NextResponse.json(
      { message: "Incorrect email or password, or the account is temporarily locked." },
      { status: 401 },
    );
  }
  const data = (await res.json()) as { accessToken: string; staff: unknown };
  const out = NextResponse.json({ staff: data.staff });
  out.cookies.set(SESSION_COOKIE, data.accessToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: config.sessionMaxAge,
  });
  // Remember this device: its future sign-in attempts get their own budget (see client-identity.ts).
  rememberDevice(out, req.cookies.get(DEVICE_COOKIE)?.value);
  out.headers.set("Cache-Control", "no-store");
  return out;
}

/**
 * Sign out. The API revokes EVERY token of this staff member (all devices). Its answer is checked:
 * - 204: revoked everywhere → 204.
 * - 401/403: the token was already invalid/revoked → nothing left to revoke → 204.
 * - 429, 5xx or unreachable: revocation NOT confirmed → 503 { revoked: false }. The cookie is still
 *   cleared on this device (a shared shop computer must never stay signed in), and the page tells
 *   the person that other devices could not be signed out, so they can try again.
 */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req) || req.headers.get(CSRF_HEADER) !== "1") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let revoked = true;
  if (token) {
    try {
      const res = await backendFetch("/api/v1/auth/logout", {
        method: "POST",
        token,
        client: requestClient(req.headers, req.cookies.get(DEVICE_COOKIE)?.value),
      });
      revoked = res.ok || res.status === 401 || res.status === 403;
    } catch {
      revoked = false;
    }
  }
  const out = revoked
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json(
        {
          revoked: false,
          message:
            "You are signed out on this device, but the server could not confirm signing you out on your other devices. Sign in and sign out again when the connection is back.",
        },
        { status: 503 },
      );
  out.headers.set("Cache-Control", "no-store");
  out.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: 0,
  });
  return out;
}
