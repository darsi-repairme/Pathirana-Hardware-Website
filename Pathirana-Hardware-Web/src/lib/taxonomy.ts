import { brandLogos, productCategories, type ProductCategory } from "@/content/products";
import { imageSrc, type LiveBrand, type LiveCategory } from "./catalogue";

/**
 * Categories and brands as the public site shows them.
 *
 * Built with NEXT_PUBLIC_API_URL, the ACTIVE categories and brands come only from
 * the website API (staff manage them in the Admin dashboard — no rebuild); a
 * build without the API shows the client-documented lists.
 *
 * Presentation that only exists for the documented entries — the original
 * brand logo files and the illustrative category artwork — is kept for the
 * matching slugs until staff upload their own logo / image.
 */

export type CategoryImage =
  /** Uploaded by staff, served by the API. */
  | { kind: "uploaded"; src: string; thumbSrc: string; alt: string; width: number; height: number }
  /** Illustrative artwork bundled with the site (documented categories only). */
  | { kind: "bundled"; key: NonNullable<ProductCategory["image"]> };

export type DisplayCategory = {
  slug: string;
  title: string;
  summary: string;
  href: string;
  /** The documented category with this slug (static page, artwork, icon), if any. */
  documented: ProductCategory | null;
  image: CategoryImage | null;
};

export type DisplayBrand = {
  slug: string;
  name: string;
  logo: { src: string; width: number; height: number; uploaded: boolean } | null;
};

/** Slugs of the brands documented by the client (as used in the Admin / seed script). */
const BRAND_SLUG: Record<(typeof brandLogos)[number]["brand"], string> = {
  "PE+": "pe-plus",
  Swisstek: "swisstek",
  "El Toro": "el-toro",
  Würth: "wurth",
};
const bundledLogo = (slug: string) => brandLogos.find((l) => BRAND_SLUG[l.brand] === slug) ?? null;

const documentedBySlug = (slug: string) => productCategories.find((c) => c.id === slug) ?? null;

/** Documented categories keep their static pages; staff-added ones use the live category page. */
export const categoryHref = (slug: string) =>
  documentedBySlug(slug) ? `/products/categories/${slug}/` : `/products/category/?slug=${encodeURIComponent(slug)}`;

export const DOCUMENTED_CATEGORIES: readonly DisplayCategory[] = productCategories.map((c) => ({
  slug: c.id,
  title: c.title,
  summary: c.summary,
  href: categoryHref(c.id),
  documented: c,
  image: c.image ? { kind: "bundled", key: c.image } : null,
}));

export const DOCUMENTED_BRANDS: readonly DisplayBrand[] = brandLogos.map((l) => ({
  slug: BRAND_SLUG[l.brand],
  name: l.brand,
  logo: { src: l.src, width: l.width, height: l.height, uploaded: false },
}));

export function toDisplayCategory(c: LiveCategory): DisplayCategory {
  const documented = documentedBySlug(c.slug);
  const uploaded = c.image
    ? ({
        kind: "uploaded",
        src: imageSrc(c.image.url),
        thumbSrc: imageSrc(c.image.thumbUrl),
        alt: c.image.alt,
        width: c.image.width,
        height: c.image.height,
      } as const)
    : null;
  return {
    slug: c.slug,
    title: c.name,
    summary: c.description?.trim() || documented?.summary || "",
    href: categoryHref(c.slug),
    documented,
    image: uploaded ?? (documented?.image ? { kind: "bundled", key: documented.image } : null),
  };
}

export function toDisplayBrand(b: LiveBrand): DisplayBrand {
  if (b.logo) {
    return {
      slug: b.slug,
      name: b.name,
      logo: { src: imageSrc(b.logo.url), width: b.logo.width, height: b.logo.height, uploaded: true },
    };
  }
  const bundled = bundledLogo(b.slug);
  return {
    slug: b.slug,
    name: b.name,
    logo: bundled ? { src: bundled.src, width: bundled.width, height: bundled.height, uploaded: false } : null,
  };
}
