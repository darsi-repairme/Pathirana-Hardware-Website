import { NextResponse, type NextRequest } from "next/server";
import { backendFetch, clientIp } from "@/lib/server/backend";
import { sameOrigin } from "@/lib/server/csrf";

/**
 * Public relay for the one-time Owner registration (no session). GET: is registration still
 * open? POST: register with the code from `npm run owner:code`. Same CSRF rules as the rest of
 * the Admin (same origin + custom header). Nothing is logged; the password is never stored here.
 */
async function relay(res: Response) {
  const body = res.status === 204 ? null : await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const unavailable = () =>
  NextResponse.json({ message: "The server is unavailable. Please try again." }, { status: 503 });

export async function GET(req: NextRequest) {
  try {
    return relay(await backendFetch("/api/v1/auth/owner-setup", { ip: clientIp(req.headers) }));
  } catch {
    return unavailable();
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
  const b = (body ?? {}) as Record<string, unknown>;
  const fields = ["code", "fullName", "email", "password", "confirmPassword"] as const;
  if (fields.some((f) => typeof b[f] !== "string"))
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  try {
    return relay(
      await backendFetch("/api/v1/auth/owner-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the five known fields are forwarded (never a role or anything else).
        body: JSON.stringify(Object.fromEntries(fields.map((f) => [f, b[f]]))),
        ip: clientIp(req.headers),
      }),
    );
  } catch {
    return unavailable();
  }
}
