/**
 * Safe `mailto:` links for customer-supplied email addresses (RFC 6068).
 *
 * The address comes from a public form, so it is never placed in the URL as-is: characters such as
 * `?`, `&`, `=`, `#`, `%` or line breaks could otherwise add recipients (cc/bcc), a body or other
 * headers. The address must look like a plain email address (no spaces, quotes, angle brackets,
 * commas or control characters, exactly one `@`, a dotted domain); its local part and domain are then
 * percent-encoded, so every character stays part of the one recipient address. Anything else gives
 * null — the address is still shown as text, staff just copy it.
 */
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}$/;
const DOMAIN =
  /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function safeEmailAddress(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim();
  if (email.length > 254) return null;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!LOCAL.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (!DOMAIN.test(domain)) return null;
  return email;
}

/** mailto: link with an encoded recipient and only the given (encoded) parameters, or null. */
export function mailtoHref(
  raw: string | null | undefined,
  params: { subject?: string; body?: string } = {},
): string | null {
  const email = safeEmailAddress(raw);
  if (!email) return null;
  const at = email.indexOf("@");
  const to = `${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}`;
  const query = Object.entries(params)
    .filter(([, v]) => typeof v === "string" && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  return `mailto:${to}${query ? `?${query}` : ""}`;
}
