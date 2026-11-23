/**
 * Public website address (WEBSITE_URL, read by the admin server at runtime) and the website's own
 * paths for each kind of record, so staff can open exactly the page customers see. Paths mirror
 * the website (Pathirana-Hardware-Web: lib/catalogue.ts productHref, lib/taxonomy.ts categoryHref,
 * lib/live-services.ts serviceHref). When WEBSITE_URL is not set, no website links are shown.
 */

/** Origin + optional base path without a trailing slash, or null if unset / not http(s). */
export function normaliseWebsiteUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** The seven documented categories have their own pre-built pages on the website. */
const DOCUMENTED_CATEGORIES = new Set([
  "building-materials",
  "steel-products",
  "plywood",
  "doors-windows",
  "bathroom-sanitary",
  "gas-cylinders",
  "branded-hardware",
]);

/** The six approved services have their own pages; any other service is a card on See More. */
const SERVICE_PAGES = new Set([
  "building-material-supply",
  "home-site-delivery",
  "bulk-orders",
  "product-reservations",
  "product-advice",
  "contractor-support",
]);

export const websitePaths = {
  home: () => "/",
  product: (slug: string) => `/products/item/?slug=${encodeURIComponent(slug)}`,
  category: (slug: string) =>
    DOCUMENTED_CATEGORIES.has(slug)
      ? `/products/categories/${slug}/`
      : `/products/category/?slug=${encodeURIComponent(slug)}`,
  service: (slug: string) =>
    SERVICE_PAGES.has(slug) ? `/services/${slug}/` : `/services/all/#${encodeURIComponent(slug)}`,
  gallery: () => "/gallery/",
};
