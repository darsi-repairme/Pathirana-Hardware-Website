import { whatsappChatHref } from "../content/business.ts";
import { getApiBase } from "./api.ts";

/** Batch 5B — customer quotation requests (no orders, no payments). */

/** Shown after a successful submission — exact wording required by the owner. */
export const QUOTATION_CONFIRMATION =
  "Thank you. Pathirana Hardware has received your quotation request. Our team will contact you to confirm prices, availability and delivery.";
/** A request is never an order: nothing is confirmed or reserved automatically. */
export const QUOTATION_NOT_AN_ORDER =
  "Submitting a quotation request does not confirm an order or reserve stock. No payment is taken.";

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_ITEMS = 30;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Common units (free text is allowed too). */
export const UNIT_SUGGESTIONS = [
  "bag",
  "piece",
  "sheet",
  "bar",
  "kg",
  "ton",
  "metre",
  "feet",
  "litre",
  "box",
  "set",
  "cube",
];

export type QuotationItem = { productName: string; productSlug?: string; quantity: string; unit: string };
export type Fulfilment = "delivery" | "collection";
export type QuotationForm = {
  customerName: string;
  phone: string;
  location: string; // a listed service area, or "Other"
  otherLocation: string;
  fulfilment: Fulfilment;
  deliveryAddress: string;
  email: string;
  notes: string;
  /** Optional promo code from a website offer (checked by the API; never changes prices). */
  promoCode?: string;
  contactConsent: boolean;
  items: QuotationItem[];
};

/** Quotation mobile number: exactly 10 digits, starting with 0 (same rule on the API). */
export const MOBILE_10 = /^0\d{9}$/;
/** Keeps digits only (typing and pasting), at most 10. */
export const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 10);
export const QUANTITY = /^(?=.*[1-9])\d{1,9}(\.\d{1,3})?$/;

/** Same rules as the API (it validates again): Sri Lankan numbers in any common form, or +country. */
export function normalisePhone(raw: string): string | null {
  let p = raw.replace(/[\s\-().]/g, "");
  if (/^0\d{9}$/.test(p)) p = `+94${p.slice(1)}`;
  else if (/^94\d{9}$/.test(p)) p = `+${p}`;
  else if (/^00\d+$/.test(p)) p = `+${p.slice(2)}`;
  return /^\+\d{9,15}$/.test(p) ? p : null;
}

export type FieldErrors = Partial<Record<string, string>>;

/** Promo codes are letters, digits and hyphens (checked again by the API). */
export const PROMO_CODE = /^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/;

/**
 * Checks a promo code against the published offers (informational: the request is saved either
 * way, and staff confirm any discount). Never throws; `null` when the check is unavailable.
 */
export async function checkPromoCode(code: string, productSlugs: string[]): Promise<PromoStatus | null> {
  const base = getApiBase();
  if (!base || !PROMO_CODE.test(code.trim())) return null;
  try {
    const res = await fetch(`${base}/api/v1/offers/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), productSlugs }),
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: PromoStatus };
    return j.status ?? null;
  } catch {
    return null;
  }
}

export function validate(f: QuotationForm, photos: File[]): FieldErrors {
  const e: FieldErrors = {};
  if (!f.customerName.trim()) e.customerName = "Enter your name.";
  if (!MOBILE_10.test(f.phone)) e.phone = "Please enter a valid 10-digit mobile number.";
  if (!f.location) e.location = "Choose your location.";
  else if (f.location === "Other" && !f.otherLocation.trim()) e.otherLocation = "Enter your town or area.";
  if (f.fulfilment === "delivery" && !f.deliveryAddress.trim()) e.deliveryAddress = "Enter the delivery address.";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (f.promoCode?.trim() && !PROMO_CODE.test(f.promoCode.trim()))
    e.promoCode = "A promo code has only letters, digits and hyphens.";
  f.items.forEach((it, i) => {
    if (!it.productName.trim()) e[`items.${i}.productName`] = "Enter the product.";
    if (!QUANTITY.test(it.quantity.trim())) e[`items.${i}.quantity`] = "Enter a quantity above 0.";
  });
  if (photos.length > MAX_PHOTOS) e.photos = `Attach at most ${MAX_PHOTOS} photos.`;
  if (!f.contactConsent)
    e.contactConsent = "Please tick the agreement box — we cannot process your request without it.";
  return e;
}

/**
 * Shrinks large photos in the browser before upload (saves mobile data); the
 * server re-encodes every photo anyway. Small files are sent unchanged.
 */
export async function prepareImage(file: File, max = 2000): Promise<File> {
  if (file.size < 600 * 1024 || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export type PromoStatus = "valid" | "not_eligible" | "expired" | "unknown";
export type SubmitResult = { reference: string; photoCount: number; duplicate: boolean; promoStatus?: PromoStatus };

export class SubmitError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Saves the request (multipart: "data" JSON + "photos"). The idempotency key makes retries safe. */
export async function submitQuotation(
  f: QuotationForm,
  photos: File[],
  idempotencyKey: string,
  /** Hidden anti-spam field: people never see or fill it; automated form-fillers often do. */
  honeypot = "",
): Promise<SubmitResult> {
  const base = getApiBase();
  if (!base) throw new SubmitError("Online quotation requests are not available right now.", 0);
  const data = {
    idempotencyKey,
    customerName: f.customerName.trim(),
    phone: f.phone.trim(),
    location: f.location,
    ...(f.location === "Other" ? { otherLocation: f.otherLocation.trim() } : {}),
    fulfilment: f.fulfilment,
    ...(f.fulfilment === "delivery" ? { deliveryAddress: f.deliveryAddress.trim() } : {}),
    ...(f.email.trim() ? { email: f.email.trim() } : {}),
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
    ...(f.promoCode?.trim() ? { promoCode: f.promoCode.trim().toUpperCase() } : {}),
    contactConsent: f.contactConsent,
    ...(honeypot ? { website: honeypot.slice(0, 200) } : {}),
    items: f.items.map((it) => ({
      productName: it.productName.trim(),
      ...(it.productSlug ? { productSlug: it.productSlug } : {}),
      quantity: it.quantity.trim(),
      ...(it.unit.trim() ? { unit: it.unit.trim() } : {}),
    })),
  };
  const body = new FormData();
  body.append("data", JSON.stringify(data));
  for (const p of photos) body.append("photos", p);
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/quotations`, { method: "POST", body, credentials: "omit", cache: "no-store" });
  } catch {
    throw new SubmitError("We could not reach our server. Check your connection and try again.", 0);
  }
  if (res.status === 201) return (await res.json()) as SubmitResult;
  let message = "Your request could not be saved. Please check the form and try again.";
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (res.status === 429) message = "Too many requests from this device. Please wait a few minutes and try again.";
    else if (res.status === 413) message = "A photo is too large. Each photo can be up to 5 MB.";
    else if (res.status === 415) message = "Photos must be JPEG, PNG or WebP images.";
    else if (res.status >= 500) message = "Our server had a problem saving your request. Please try again.";
    else if (j.message) message = Array.isArray(j.message) ? j.message.join(" ") : j.message;
  } catch {
    /* keep the generic message */
  }
  throw new SubmitError(message, res.status);
}

/** Labels of the WhatsApp message in the visitor's language (customer-entered values are never changed). */
const WA_EN = {
  hello: "Hello Pathirana Hardware,",
  intro: "I would like to request a quotation.",
  reference: "Quotation Reference",
  name: "Customer Name",
  phone: "Contact Number",
  items: "Requested Items:",
  quantity: "Quantity",
  fulfilment: "Delivery/Pickup",
  delivery: "Delivery",
  collection: "Pickup from the store",
  location: "Location",
  address: "Delivery Address",
  notes: "Additional Notes",
  promo: "Promo Code",
  photos1: "I attached 1 reference photo to this request on your website.",
  photosN: "I attached {n} reference photos to this request on your website.",
  review: "Please review my request and confirm prices, stock availability and delivery arrangements.",
  thanks: "Thank you.",
};
const WA: Record<"en" | "ta" | "si", Record<keyof typeof WA_EN, string>> = {
  en: WA_EN,
  ta: {
    hello: "வணக்கம் Pathirana Hardware,",
    intro: "நான் ஒரு விலைக்கூறலைக் கோர விரும்புகிறேன்.",
    reference: "விலைக்கூறல் குறிப்பு எண்",
    name: "வாடிக்கையாளர் பெயர்",
    phone: "தொடர்பு எண்",
    items: "கோரப்பட்ட பொருட்கள்:",
    quantity: "அளவு",
    fulfilment: "விநியோகம்/பெற்றுக்கொள்ளல்",
    delivery: "விநியோகம்",
    collection: "கடையிலிருந்து பெற்றுக்கொள்ளல்",
    location: "இருப்பிடம்",
    address: "விநியோக முகவரி",
    notes: "கூடுதல் குறிப்புகள்",
    promo: "சலுகைக் குறியீடு",
    photos1: "உங்கள் இணையதளத்தில் இந்தக் கோரிக்கையுடன் 1 குறிப்புப் படத்தை இணைத்துள்ளேன்.",
    photosN: "உங்கள் இணையதளத்தில் இந்தக் கோரிக்கையுடன் {n} குறிப்புப் படங்களை இணைத்துள்ளேன்.",
    review: "எனது கோரிக்கையைப் பரிசீலித்து விலைகள், இருப்பு மற்றும் விநியோக ஏற்பாடுகளை உறுதிப்படுத்தவும்.",
    thanks: "நன்றி.",
  },
  si: {
    hello: "ආයුබෝවන් Pathirana Hardware,",
    intro: "මට මිල ගණනක් ඉල්ලා සිටීමට අවශ්‍යයි.",
    reference: "මිල ගණන් ඉල්ලීමේ යොමු අංකය",
    name: "පාරිභෝගිකයාගේ නම",
    phone: "සම්බන්ධතා අංකය",
    items: "ඉල්ලූ භාණ්ඩ:",
    quantity: "ප්‍රමාණය",
    fulfilment: "බෙදාහැරීම/රැගෙන යාම",
    delivery: "බෙදාහැරීම",
    collection: "වෙළඳසැලෙන් රැගෙන යාම",
    location: "ස්ථානය",
    address: "බෙදාහැරීමේ ලිපිනය",
    notes: "අමතර සටහන්",
    promo: "ප්‍රවර්ධන කේතය",
    photos1: "මම ඔබේ වෙබ් අඩවියේ මෙම ඉල්ලීමට යොමු ඡායාරූප 1ක් අමුණා ඇත්තෙමි.",
    photosN: "මම ඔබේ වෙබ් අඩවියේ මෙම ඉල්ලීමට යොමු ඡායාරූප {n}ක් අමුණා ඇත්තෙමි.",
    review: "කරුණාකර මගේ ඉල්ලීම සලකා බලා මිල ගණන්, තොග පවතින බව සහ බෙදාහැරීමේ විධිවිධාන තහවුරු කරන්න.",
    thanks: "ස්තූතියි.",
  },
};
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k]));

const qty = (it: QuotationItem) => `${it.quantity.trim()}${it.unit.trim() ? ` ${it.unit.trim()}` : ""}`;

/**
 * The editable WhatsApp message the customer sends (they tap Send themselves). Built only from
 * what the customer entered and the saved PHQ reference — no photo links, prices or promises.
 */
export function quotationWhatsappText(
  reference: string,
  f: QuotationForm,
  photoCount: number,
  locale: "en" | "ta" | "si" = "en",
  /** Display name of the chosen area in the visitor's language (defaults to the stored name). */
  locationLabel?: string,
): string {
  const m = WA[locale];
  const location = f.location === "Other" ? f.otherLocation.trim() : (locationLabel ?? f.location);
  const lines = [
    m.hello,
    "",
    m.intro,
    "",
    `${m.reference}: ${reference}`,
    "",
    `${m.name}: ${f.customerName.trim()}`,
    `${m.phone}: ${f.phone.trim()}`,
    "",
    m.items,
    ...f.items.map((it, i) => `${i + 1}. ${it.productName.trim()} — ${m.quantity}: ${qty(it)}`),
    "",
    `${m.fulfilment}: ${f.fulfilment === "delivery" ? m.delivery : m.collection}`,
    `${m.location}: ${location}`,
    ...(f.fulfilment === "delivery" && f.deliveryAddress.trim() ? [`${m.address}: ${f.deliveryAddress.trim()}`] : []),
    ...(f.notes.trim() ? [`${m.notes}: ${f.notes.trim()}`] : []),
    ...(f.promoCode?.trim() ? [`${m.promo}: ${f.promoCode.trim().toUpperCase()}`] : []),
    ...(photoCount ? ["", fill(photoCount === 1 ? m.photos1 : m.photosN, { n: photoCount })] : []),
    "",
    m.review,
    "",
    m.thanks,
  ];
  return lines.join("\n");
}

export const whatsappTextHref = (text: string) => `${whatsappChatHref}?text=${encodeURIComponent(text)}`;

/** Product page → quotation form, with the product prefilled. */
export const quotationHref = (name: string, slug?: string) =>
  `/quotation/?product=${encodeURIComponent(name)}${slug ? `&slug=${encodeURIComponent(slug)}` : ""}`;
