import { whatsappChatHref } from "@/content/business";
import { getApiBase } from "./api";

/** Batch 5B — customer quotation requests (no orders, no payments). */

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
  contactConsent: boolean;
  items: QuotationItem[];
};

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

export function validate(f: QuotationForm, photos: File[]): FieldErrors {
  const e: FieldErrors = {};
  if (!f.customerName.trim()) e.customerName = "Enter your name.";
  if (!f.phone.trim()) e.phone = "Enter your phone or WhatsApp number.";
  else if (!normalisePhone(f.phone))
    e.phone = "Enter a valid phone number: 10 digits starting with 0, or +94 and 9 digits.";
  if (!f.location) e.location = "Choose your location.";
  else if (f.location === "Other" && !f.otherLocation.trim()) e.otherLocation = "Enter your town or area.";
  if (f.fulfilment === "delivery" && !f.deliveryAddress.trim()) e.deliveryAddress = "Enter the delivery address.";
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  f.items.forEach((it, i) => {
    if (!it.productName.trim()) e[`items.${i}.productName`] = "Enter the product.";
    if (!QUANTITY.test(it.quantity.trim())) e[`items.${i}.quantity`] = "Enter a quantity above 0.";
  });
  if (photos.length > MAX_PHOTOS) e.photos = `Attach at most ${MAX_PHOTOS} photos.`;
  if (!f.contactConsent) e.contactConsent = "Please agree so that we can contact you about this request.";
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

export type SubmitResult = { reference: string; photoCount: number; duplicate: boolean };

export class SubmitError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Saves the request (multipart: "data" JSON + "photos"). The idempotency key makes retries safe. */
export async function submitQuotation(f: QuotationForm, photos: File[], idempotencyKey: string): Promise<SubmitResult> {
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
    contactConsent: f.contactConsent,
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

const qty = (it: QuotationItem) => `${it.quantity.trim()}${it.unit.trim() ? ` ${it.unit.trim()}` : ""}`;

/** The editable WhatsApp message the customer sends (they tap Send themselves). */
export function quotationWhatsappText(reference: string, f: QuotationForm, photoCount: number): string {
  const location = f.location === "Other" ? f.otherLocation.trim() : f.location;
  const lines = [
    "Hello Pathirana Hardware,",
    `I have submitted quotation request ${reference} on your website.`,
    "",
    `Name: ${f.customerName.trim()}`,
    `Phone: ${f.phone.trim()}`,
    ...(f.email.trim() ? [`Email: ${f.email.trim()}`] : []),
    `Location: ${location}`,
    `Delivery or collection: ${f.fulfilment === "delivery" ? "Delivery" : "Collection from the store"}`,
    ...(f.fulfilment === "delivery" ? [`Delivery address: ${f.deliveryAddress.trim()}`] : []),
    "",
    "Items:",
    ...f.items.map((it, i) => `${i + 1}. ${it.productName.trim()} — ${qty(it)}`),
    ...(f.notes.trim() ? ["", `Notes: ${f.notes.trim()}`] : []),
    ...(photoCount
      ? ["", `I attached ${photoCount} reference photo${photoCount === 1 ? "" : "s"} to quotation ${reference}.`]
      : []),
    "",
    "Please send me a quotation.",
  ];
  return lines.join("\n");
}

export const whatsappTextHref = (text: string) => `${whatsappChatHref}?text=${encodeURIComponent(text)}`;

/** Product page → quotation form, with the product prefilled. */
export const quotationHref = (name: string, slug?: string) =>
  `/quotation/?product=${encodeURIComponent(name)}${slug ? `&slug=${encodeURIComponent(slug)}` : ""}`;
