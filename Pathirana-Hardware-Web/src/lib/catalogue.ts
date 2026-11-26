import { apiGet, getApiBase } from "./api";

/**
 * Live catalogue from the website API: PUBLISHED products only (the API never
 * returns drafts). Prices and discounts are calculated by the API — the single
 * authoritative calculation — and only displayed here.
 */

export type Availability = "available" | "out_of_stock" | "on_request";

export type LivePrice = {
  currency: "LKR";
  contactForPrice: boolean;
  original: string | null;
  discount: {
    type: "percentage" | "fixed";
    value: string;
    amount: string;
    startsOn: string | null;
    endsOn: string | null;
  } | null;
  final: string | null;
};

export type LiveImage = { url: string; thumbUrl: string; alt: string; width: number; height: number };

/** Staff-entered Tamil / Sinhala text (API with migration 0006). Older APIs omit it → English. */
export type LiveTranslations<K extends string> = Partial<Record<"ta" | "si", Partial<Record<K, string>>>>;

export type LiveProduct = {
  slug: string;
  name: string;
  summary: string | null;
  description?: string | null;
  translations?: LiveTranslations<"name" | "summary" | "description">;
  category: { slug: string; name: string; translations?: LiveTranslations<"name"> };
  brands: { slug: string; name: string }[];
  unit: string | null;
  availability: Availability;
  /** Missing only if an older API answers; treated as Contact for Price. */
  price?: LivePrice;
  image: LiveImage | null;
  images?: LiveImage[];
};

export type LivePage = { items: LiveProduct[]; total: number; page: number; limit: number };
export type LiveCategory = {
  slug: string;
  name: string;
  description: string | null;
  translations?: LiveTranslations<"name" | "description">;
  productCount: number;
  /** Staff-uploaded image (API with migration 0003); absent or null otherwise. */
  image?: { url: string; thumbUrl: string; alt: string; width: number; height: number } | null;
};
export type LiveBrand = {
  slug: string;
  name: string;
  /** Staff-uploaded logo (API with migration 0003); absent or null otherwise. */
  logo?: { url: string; width: number; height: number } | null;
};

/** True when the site was built with NEXT_PUBLIC_API_URL (live catalogue). */
export const liveCatalogueEnabled = () => getApiBase() !== null;

export const PAGE_SIZE = 12;

export function fetchProducts(
  q: { q?: string; category?: string; brand?: string; page?: number },
  signal?: AbortSignal,
): Promise<LivePage> {
  const sp = new URLSearchParams();
  if (q.q?.trim()) sp.set("q", q.q.trim().slice(0, 80));
  if (q.category) sp.set("category", q.category);
  if (q.brand) sp.set("brand", q.brand);
  sp.set("page", String(q.page ?? 1));
  sp.set("limit", String(PAGE_SIZE));
  return apiGet<LivePage>(`/api/v1/products?${sp}`, signal);
}

export class NotFoundError extends Error {}

export async function fetchProduct(slug: string, signal?: AbortSignal): Promise<LiveProduct> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundError("Invalid product");
  try {
    return await apiGet<LiveProduct>(`/api/v1/products/${slug}`, signal);
  } catch (e) {
    if ((e as Error).message === "API 404") throw new NotFoundError("Not found");
    throw e;
  }
}

export const fetchCategories = (signal?: AbortSignal) =>
  apiGet<{ items: LiveCategory[] }>("/api/v1/categories", signal).then((r) => r.items);
export const fetchBrands = (signal?: AbortSignal) =>
  apiGet<{ items: LiveBrand[] }>("/api/v1/brands", signal).then((r) => r.items);

/** Absolute URL of an API-served (published) product image. */
export const imageSrc = (url: string) => `${getApiBase() ?? ""}${url}`;

/** Static-export-friendly detail route for live products (no rebuild per product). */
export const productHref = (slug: string) => `/products/item/?slug=${encodeURIComponent(slug)}`;

export const priceOf = (p: LiveProduct): LivePrice =>
  p.price ?? { currency: "LKR", contactForPrice: true, original: null, discount: null, final: null };

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Available",
  out_of_stock: "Out of Stock",
  on_request: "On Request",
};

/** "2250.5" → "LKR 2,250.50" — formatting only, no arithmetic (shared with the WhatsApp enquiry). */
export { formatLkr } from "./money";

/** "10.00" → "10%". */
export const formatPercent = (v: string) => `${v.replace(/\.?0+$/, "")}%`;

/** "2026-12-31" → "31 Dec 2026" (date only; no timezone shifts). Other languages: the browser's local month names. */
export function formatDate(d: string, htmlLang = "en"): string {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  if (!htmlLang.startsWith("en")) {
    try {
      return new Intl.DateTimeFormat(htmlLang, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(y, m - 1, day)));
    } catch {
      // Fall through to the English format.
    }
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[m - 1]} ${y}`;
}
