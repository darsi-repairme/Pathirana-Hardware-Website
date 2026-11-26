import { whatsappChatHref } from "../content/business.ts";
import { formatLkr } from "./money.ts";
import { getSiteUrl } from "./site-url.ts";

/**
 * The ONE product-specific WhatsApp enquiry used by every product button
 * (product cards, product-type cards, product pages, search results). It only
 * opens a chat with an editable, pre-filled message — the customer presses Send.
 *
 * Client-requested format (2026-11-19):
 *
 *   Hello Pathirana Hardware,
 *
 *   I am interested in [Product name].
 *   Product reference: [Reference, if available].
 *   Price shown: LKR [displayed price].
 *   Quantity: [enter quantity].
 *   My location: [enter location].
 *   Product link: [actual product URL]
 *
 *   Please confirm availability and delivery charges.
 *
 * Rules: the reference line appears only for a genuine reference (never the URL
 * slug); the price is the DISPLAYED selling price (after any active discount);
 * Contact for Price never becomes "LKR Contact for Price"; the link is a public
 * product URL — never localhost, 127.0.0.1 or a private-network address — and
 * is left out when no public address is known. No period follows the link, so
 * WhatsApp does not fold it into the tapped URL.
 */

/**
 * PENDING CLIENT APPROVAL: the earlier brief said delivery charges must not be
 * displayed or requested through the website; this newer client wording asks
 * staff to confirm them in the chat. Confirm in writing before production.
 */
export const PRODUCT_ENQUIRY_CLOSING = "Please confirm availability and delivery charges.";

export type EnquiryLocale = "en" | "ta" | "si";

/**
 * The same message in the visitor's website language (faithful translations of
 * the approved English wording — no new promises). The business name, product
 * reference, LKR price, staff-entered unit and the link are never translated.
 * Tamil / Sinhala wording: PENDING CLIENT REVIEW by a native speaker.
 */
const TEMPLATE: Record<
  EnquiryLocale,
  {
    hello: string;
    interested: (name: string) => string;
    reference: string;
    price: string;
    contactForPrice: string;
    quantity: string;
    location: string;
    link: string;
    closing: string;
  }
> = {
  en: {
    hello: "Hello Pathirana Hardware,",
    interested: (n) => `I am interested in ${n}.`,
    reference: "Product reference",
    price: "Price shown",
    contactForPrice: "Contact for Price",
    quantity: "Quantity: [enter quantity].",
    location: "My location: [enter location].",
    link: "Product link",
    closing: PRODUCT_ENQUIRY_CLOSING,
  },
  ta: {
    hello: "வணக்கம் Pathirana Hardware,",
    interested: (n) => `எனக்கு ${n} தொடர்பாக ஆர்வம் உள்ளது.`,
    reference: "பொருள் குறிப்பு எண்",
    price: "காட்டப்பட்ட விலை",
    contactForPrice: "விலைக்கு தொடர்பு கொள்ளவும்",
    quantity: "அளவு: [அளவை உள்ளிடவும்].",
    location: "எனது இருப்பிடம்: [இருப்பிடத்தை உள்ளிடவும்].",
    link: "பொருள் இணைப்பு",
    closing: "தயவுசெய்து பொருள் கிடைக்குமா என்பதையும் விநியோகக் கட்டணங்களையும் உறுதிப்படுத்தவும்.",
  },
  si: {
    hello: "ආයුබෝවන් Pathirana Hardware,",
    interested: (n) => `මම ${n} ගැන උනන්දුවෙන් සිටිමි.`,
    reference: "නිෂ්පාදන යොමු අංකය",
    price: "පෙන්වා ඇති මිල",
    contactForPrice: "මිල සඳහා අමතන්න",
    quantity: "ප්‍රමාණය: [ප්‍රමාණය ඇතුළත් කරන්න].",
    location: "මගේ ස්ථානය: [ස්ථානය ඇතුළත් කරන්න].",
    link: "නිෂ්පාදන සබැඳිය",
    closing: "කරුණාකර භාණ්ඩය ලබා ගත හැකිද යන්න සහ බෙදාහැරීමේ ගාස්තු තහවුරු කරන්න.",
  },
};

/** The price as the website shows it (calculated by the API). Missing = Contact for Price. */
export type ShownPrice = { contactForPrice: boolean; final: string | null } | null | undefined;

export type ProductEnquiry = {
  name: string;
  /** A genuine product reference supplied by the shop. Never pass the slug. */
  reference?: string | null;
  price?: ShownPrice;
  /** Unit of sale shown beside the price, e.g. "bag". */
  unit?: string | null;
  /** Site path of the product page, e.g. "/products/item/?slug=cement". */
  path?: string | null;
  /**
   * Browser origin, used only when NEXT_PUBLIC_SITE_URL is not configured and
   * only for pages rendered in the browser (never during the static build).
   */
  origin?: string | null;
  /** Website language of the visitor (default English). `name` should already be in it when available. */
  locale?: EnquiryLocale;
};

const tidy = (s: string) => s.trim().replace(/\s+/g, " ").replace(/\.+$/, "");

/** "LKR 2,250.00 / bag", or "Contact for Price" (no price, Contact for Price, or missing final price). */
export function shownPriceText(price: ShownPrice, unit?: string | null, locale: EnquiryLocale = "en"): string {
  if (!price || price.contactForPrice || !price.final) return TEMPLATE[locale].contactForPrice;
  const u = unit?.trim();
  return `${formatLkr(price.final)}${u ? ` / ${u}` : ""}`;
}

/** True for loopback, unspecified, link-local, private-network and .local hosts. */
export function isNonPublicHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h.includes(":")) {
    // IPv6 literal: loopback, unspecified, link-local (fe80::/10) or unique-local (fc00::/7).
    return h === "::1" || h === "::" || /^fe[89ab]/.test(h) || /^f[cd]/.test(h);
  }
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/** Absolute public product URL, or null when no public address is known. */
export function publicProductUrl(
  path: string | null | undefined,
  origin?: string | null,
  siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): string | null {
  if (!path) return null;
  const clean = path.startsWith("/") ? path : `/${path}`;
  const site = getSiteUrl(siteUrl);
  if (site && !isNonPublicHost(site.hostname)) return `${site.origin}${site.pathname.replace(/\/+$/, "")}${clean}`;
  if (!origin) return null;
  try {
    const o = new URL(origin);
    if ((o.protocol !== "https:" && o.protocol !== "http:") || isNonPublicHost(o.hostname)) return null;
    return `${o.origin}${clean}`;
  } catch {
    return null;
  }
}

/** The editable message text (before URL encoding). */
export function productEnquiryText(p: ProductEnquiry, siteUrl?: string): string {
  const reference = p.reference ? tidy(p.reference) : "";
  const link = publicProductUrl(p.path, p.origin, siteUrl);
  const locale = p.locale ?? "en";
  const m = TEMPLATE[locale];
  return [
    m.hello,
    "",
    m.interested(tidy(p.name)),
    ...(reference ? [`${m.reference}: ${reference}.`] : []),
    `${m.price}: ${shownPriceText(p.price, p.unit, locale)}.`,
    m.quantity,
    m.location,
    ...(link ? [`${m.link}: ${link}`] : []),
    "",
    m.closing,
  ].join("\n");
}

/** wa.me link to the business number with the fully URL-encoded message. */
export function productEnquiryHref(p: ProductEnquiry, siteUrl?: string): string {
  return `${whatsappChatHref}?text=${encodeURIComponent(productEnquiryText(p, siteUrl))}`;
}
