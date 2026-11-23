import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-time Owner set-up codes (no database table): 16 characters, "XXXX-XXXX-XXXX-XXXX", in
 * Crockford base32 (no I, L, O or U, so it is easy to read out and type). The code carries its
 * own expiry (minutes since 1970) and a 48-bit HMAC of that expiry made with a key derived from
 * the API's JWT_SECRET, so it cannot be forged or changed. It is "single use" because Owner
 * registration only exists while NO administrator exists: the first successful registration
 * creates the administrator and closes it for every code.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAC_BYTES = 6;
export const OWNER_CODE_MAX_MINUTES = 24 * 60;

const key = (secret: string) => createHmac("sha256", secret).update("pathirana/owner-setup/v1").digest();
const mac = (secret: string, expiry: Buffer) =>
  createHmac("sha256", key(secret)).update(expiry).digest().subarray(0, MAC_BYTES);

function toBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(s: string): Buffer | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = ((value << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Upper case, no spaces or dashes; the look-alikes O → 0 and I / L → 1 (Crockford). */
export function normaliseOwnerCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

/** A new code valid for `minutes` (1 … 1440). Never stored anywhere. */
export function createOwnerCode(
  secret: string,
  minutes: number,
  now = Date.now(),
): { code: string; expiresAt: Date } {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > OWNER_CODE_MAX_MINUTES)
    throw new Error(`Minutes must be a whole number from 1 to ${OWNER_CODE_MAX_MINUTES}.`);
  const expiryMinutes = Math.floor(now / 60_000) + minutes;
  const expiry = Buffer.alloc(4);
  expiry.writeUInt32BE(expiryMinutes);
  const raw = toBase32(Buffer.concat([expiry, mac(secret, expiry)])); // 10 bytes → 16 characters
  return { code: raw.match(/.{4}/g)!.join("-"), expiresAt: new Date(expiryMinutes * 60_000) };
}

/** True only for an authentic, unexpired code (constant-time comparison). */
export function verifyOwnerCode(secret: string, input: string, now = Date.now()): boolean {
  const s = normaliseOwnerCode(input);
  if (s.length !== 16) return false;
  const bytes = fromBase32(s);
  if (!bytes || bytes.length !== 4 + MAC_BYTES) return false;
  const expiry = bytes.subarray(0, 4);
  if (!timingSafeEqual(mac(secret, expiry), bytes.subarray(4))) return false;
  return expiry.readUInt32BE() * 60_000 > now;
}
