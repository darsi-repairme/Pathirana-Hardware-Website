import { NextResponse, type NextRequest } from "next/server";
import { backendFetch, clientIp } from "@/lib/server/backend";
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
      ip: clientIp(req.headers),
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
  out.headers.set("Cache-Control", "no-store");
  return out;
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req) || req.headers.get(CSRF_HEADER) !== "1") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await backendFetch("/api/v1/auth/logout", { method: "POST", token });
    } catch {
      // The cookie is cleared below regardless.
    }
  }
  const out = new NextResponse(null, { status: 204 });
  out.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: 0,
  });
  return out;
}
