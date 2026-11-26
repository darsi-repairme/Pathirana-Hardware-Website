import { imageSrc, type LiveBrand, type LiveCategory, type LiveTranslations } from "./catalogue";

/**
 * Categories and brands as the public site shows them.
 *
 * They come ONLY from the website API (the ACTIVE categories and brands staff manage in the
 * Admin dashboard — no rebuild). Nothing bundled with the site is shown: no built-in category
 * list, artwork or brand logo files. Only images and logos staff uploaded appear; an entry
 * without one shows a neutral icon card / monogram.
 */

/** Uploaded by staff, served by the API. */
export type CategoryImage = {
  kind: "uploaded";
  src: string;
  thumbSrc: string;
  alt: string;
  width: number;
  height: number;
};

export type DisplayCategory = {
  slug: string;
  title: string;
  summary: string;
  href: string;
  image: CategoryImage | null;
  /** Staff translations of the live name ("name") and description ("summary"). */
  translations?: LiveTranslations<"name" | "summary">;
};

export type DisplayBrand = {
  slug: string;
  name: string;
  /** Staff-uploaded logo, if any. */
  logo: { src: string; width: number; height: number } | null;
};

/** Every category has the live category page. */
export const categoryHref = (slug: string) => `/products/category/?slug=${encodeURIComponent(slug)}`;

export function toDisplayCategory(c: LiveCategory): DisplayCategory {
  const tr = c.translations;
  return {
    slug: c.slug,
    title: c.name,
    summary: c.description?.trim() || "",
    translations: tr
      ? {
          ta: { name: tr.ta?.name, summary: tr.ta?.description },
          si: { name: tr.si?.name, summary: tr.si?.description },
        }
      : undefined,
    href: categoryHref(c.slug),
    image: c.image
      ? {
          kind: "uploaded",
          src: imageSrc(c.image.url),
          thumbSrc: imageSrc(c.image.thumbUrl),
          alt: c.image.alt,
          width: c.image.width,
          height: c.image.height,
        }
      : null,
  };
}

export function toDisplayBrand(b: LiveBrand): DisplayBrand {
  return {
    slug: b.slug,
    name: b.name,
    logo: b.logo ? { src: imageSrc(b.logo.url), width: b.logo.width, height: b.logo.height } : null,
  };
}
