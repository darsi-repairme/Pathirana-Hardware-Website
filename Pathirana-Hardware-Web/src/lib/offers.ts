"use client";

import { apiGet, getApiBase } from "./api";

/**
 * Offers & promo codes published in the Admin (API `GET /api/v1/offers`: only published offers
 * inside their dates). Nothing is bundled: without the API, or when none are published, the
 * header shows an honest empty state — never sample promotions.
 */
export type OfferLink = { name: string; slug: string };
export type Offer = {
  id: string;
  title: string;
  benefit: string;
  description: string;
  discountType: "none" | "percentage" | "fixed";
  discountValue: number | null;
  promoCode: string | null;
  minPurchaseLkr: number | null;
  appliesTo: "all" | "selected";
  endsOn: string | null;
  translations?: Partial<Record<"ta" | "si", Partial<Record<string, unknown>>>>;
  products: OfferLink[];
  categories: OfferLink[];
};

export const offersEnabled = () => getApiBase() !== null;

/** One request per minute is shared (re-opening the menu does not refetch). */
let entry: { at: number; promise: Promise<Offer[]> } | null = null;
export function loadOffers(): Promise<Offer[]> {
  if (!entry || Date.now() - entry.at > 60_000) {
    const promise = apiGet<{ items: Offer[] }>("/api/v1/offers")
      .then((r) => (Array.isArray(r?.items) ? r.items : []))
      .catch((e: unknown) => {
        entry = null;
        throw e;
      });
    entry = { at: Date.now(), promise };
  }
  return entry.promise;
}

/** Quotation form link that pre-fills the promo code. */
export const quotationWithCodeHref = (code: string) => `/quotation/?promo=${encodeURIComponent(code)}`;

/** Copies text; falls back to a temporary text field where the Clipboard API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
