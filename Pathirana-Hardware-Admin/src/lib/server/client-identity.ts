import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { config } from "./config";

/**
 * Which client a request comes from, told to the API so rate limits and sign-in failure limits
 * apply per staff device instead of to everyone behind this Admin server together.
 *
 * - Remembered device: after a successful sign-in the browser gets a signed, HttpOnly
 *   `ph_admin_device` cookie (a random id, no personal data). Its sign-in attempts then have their
 *   own budget, so a stranger flooding the sign-in page cannot block staff on known devices.
 * - Otherwise, behind a trusted reverse proxy (ADMIN_TRUST_PROXY=true): the visitor address.
 *
 * The identity is signed with ADMIN_CLIENT_SECRET (shared with the API), so the API accepts it only
 * from this server. Without the secret nothing is signed and the API falls back to the
 * connection address (the previous behaviour).
 */
export const DEVICE_COOKIE = "ph_admin_device";
const DEVICE_MAX_AGE = 180 * 24 * 60 * 60; // seconds

const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

/** Same formula as the API (Pathirana-Hardware-Backend/src/common/client-identity.ts). */
export function signClientId(secret: string, id: string): string {
  return hmac(secret, `ph-client-v1:${id}`);
}

/** The device id from a valid device cookie, or undefined (missing, malformed or forged). */
export function deviceIdFrom(cookie: string | undefined): string | undefined {
  const secret = config.clientSecret;
  if (!secret || !cookie) return undefined;
  const m = /^([A-Za-z0-9_-]{32})\.([0-9a-f]{64})$/.exec(cookie);
  if (!m) return undefined;
  const expected = Buffer.from(hmac(secret, `ph-device-v1:${m[1]}`), "hex");
  return timingSafeEqual(expected, Buffer.from(m[2]!, "hex")) ? m[1] : undefined;
}

/** After a successful sign-in: remember this device (keeps an existing valid cookie). */
export function rememberDevice(res: NextResponse, existing: string | undefined): void {
  const secret = config.clientSecret;
  if (!secret || deviceIdFrom(existing)) return;
  const id = randomBytes(24).toString("base64url");
  res.cookies.set(DEVICE_COOKIE, `${id}.${hmac(secret, `ph-device-v1:${id}`)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: DEVICE_MAX_AGE,
  });
}

/**
 * Visitor address forwarded as X-Forwarded-For (only behind a trusted reverse proxy:
 * ADMIN_TRUST_PROXY=true). The LAST hop — the one that proxy appended — is used; earlier hops are
 * client-supplied and could be forged.
 */
export function clientIp(headers: Headers): string | undefined {
  if (!config.trustProxy) return undefined;
  const hops =
    headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((h) => h.trim())
      .filter(Boolean) ?? [];
  const ip = hops[hops.length - 1] ?? headers.get("x-real-ip") ?? undefined;
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : undefined;
}

export type RequestClient = { ip?: string; id?: string };

/** The client of an incoming request: its trusted address and the identity to sign for the API. */
export function requestClient(headers: Headers, deviceCookie: string | undefined): RequestClient {
  const ip = clientIp(headers);
  const device = deviceIdFrom(deviceCookie);
  return { ip, id: device ? `dev:${device}` : ip ? `ip:${ip}` : undefined };
}

/** Request headers telling the API who the client is (nothing without a secret or an identity). */
export function clientHeaders(client: RequestClient | undefined, h: Headers): void {
  if (!client) return;
  // Previous behaviour, kept for APIs running with TRUST_PROXY=true behind this server.
  if (client.ip) h.set("X-Forwarded-For", client.ip);
  if (client.id && config.clientSecret) {
    h.set("X-PH-Client", client.id);
    h.set("X-PH-Client-Sig", signClientId(config.clientSecret, client.id));
  }
}
