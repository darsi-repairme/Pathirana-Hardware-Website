import { NextResponse, type NextRequest } from "next/server";
import { backendFetch, clientIp } from "@/lib/server/backend";
import { sameOrigin } from "@/lib/server/csrf";

/**
 * Public relay for the one-time staff password set-up / reset link (no session: the
 * token in the link is the proof). GET checks a link; POST sets the password. Same CSRF
 * rules as the rest of the Admin (same origin + custom header). Nothing is logged.
 */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

async function relay(res: Response) {
  const body = res.status === 204 ? null : await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!TOKEN.test(token)) return NextResponse.json({ message: "This link is not valid." }, { status: 400 });
  try {
    return relay(
      await backendFetch(`/api/v1/auth/password-setup?token=${encodeURIComponent(token)}`, {
        ip: clientIp(req.headers),
      }),
    );
  } catch {
    return NextResponse.json({ message: "The server is unavailable. Please try again." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req) || req.headers.get("x-ph-admin") !== "1")
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
  const { token, password } = (body ?? {}) as { token?: unknown; password?: unknown };
  if (typeof token !== "string" || typeof password !== "string")
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  try {
    return relay(
      await backendFetch("/api/v1/auth/password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        ip: clientIp(req.headers),
      }),
    );
  } catch {
    return NextResponse.json({ message: "The server is unavailable. Please try again." }, { status: 503 });
  }
}
