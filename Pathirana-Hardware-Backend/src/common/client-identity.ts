import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Who is calling, for rate limits and sign-in failure counting.
 *
 * - Signed-in staff (a valid staff JWT): `staff:<id>|<client source>`. Every staff member — on each
 *   of their devices — has their own request budget, so anonymous traffic can never use up the
 *   budget of signed-in staff, and one busy device does not slow the person's other devices.
 * - Anonymous requests relayed by the Admin server: the Admin signs the client identity it
 *   trusts (a remembered staff device, or the visitor address from its trusted reverse proxy)
 *   with ADMIN_CLIENT_SECRET. Only a valid signature is accepted, so callers cannot choose their
 *   own identity by sending headers.
 * - Everything else: the connection address (`req.ip`, which honours TRUST_PROXY).
 */
export const CLIENT_ID_HEADER = "x-ph-client";
export const CLIENT_SIG_HEADER = "x-ph-client-sig";

/** Same formula as the Admin server (Pathirana-Hardware-Admin/src/lib/server/client-identity.ts). */
export function signClientId(secret: string, id: string): string {
  return createHmac("sha256", secret).update(`ph-client-v1:${id}`).digest("hex");
}

/** Identities the Admin may send: `dev:<random id>` (remembered device) or `ip:<address>`. */
const CLIENT_ID = /^(dev:[A-Za-z0-9_-]{16,64}|ip:[0-9a-fA-F:.]{2,45})$/;

export type IdentifiedRequest = Request & { clientSource?: string; staffTracker?: string };

type TokenVerifier = (token: string) => { sub?: unknown } | null;

export function clientIdentity(secret: string | undefined, verifyToken: TokenVerifier) {
  return (req: IdentifiedRequest, _res: Response, next: NextFunction) => {
    req.clientSource = `addr:${req.ip ?? "unknown"}`;
    const id = req.header(CLIENT_ID_HEADER);
    const sig = req.header(CLIENT_SIG_HEADER);
    if (secret && id && sig && CLIENT_ID.test(id) && /^[0-9a-f]{64}$/.test(sig)) {
      const expected = Buffer.from(signClientId(secret, id), "hex");
      if (timingSafeEqual(expected, Buffer.from(sig, "hex"))) req.clientSource = `admin:${id}`;
    }
    const [scheme, token] = (req.header("authorization") ?? "").split(" ");
    if (scheme === "Bearer" && token) {
      const sub = verifyToken(token)?.sub;
      if (typeof sub === "string" && sub) req.staffTracker = `staff:${sub}|${req.clientSource}`;
    }
    next();
  };
}

/** Default rate-limit key: the signed-in staff member, otherwise the client source. */
export function requestTracker(req: Record<string, unknown>): Promise<string> {
  const r = req as unknown as IdentifiedRequest;
  return Promise.resolve(r.staffTracker ?? r.clientSource ?? `addr:${r.ip ?? "unknown"}`);
}

/** The client source alone (sign-in failure counting). */
export function clientSourceOf(req: Request): string {
  const r = req as IdentifiedRequest;
  return r.clientSource ?? `addr:${r.ip ?? "unknown"}`;
}

/** Sign-in rate-limit key: client source + the email being tried (one hash, never the address). */
export function loginTracker(req: Record<string, unknown>): Promise<string> {
  const r = req as unknown as IdentifiedRequest;
  const body = (r.body ?? {}) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 32);
  return Promise.resolve(`${clientSourceOf(r)}|${hash}`);
}
