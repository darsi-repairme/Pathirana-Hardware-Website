import type { Metadata } from "next";
import { business } from "@/content/business";
import { absoluteUrl, getSiteUrl } from "./site-url";

type PageMeta = {
  /** Page-specific title (the site name is appended by the root template). */
  title?: string;
  description: string;
  /** Route path with trailing slash, e.g. "/about/". */
  path: string;
};

const OG_IMAGE = "/images/brand/og-image.png";

/**
 * Builds consistent per-page metadata. Canonical and Open Graph URLs are only
 * emitted when NEXT_PUBLIC_SITE_URL is configured, so no wrong domain is ever
 * published.
 */
export function createPageMetadata({ title, description, path }: PageMeta): Metadata {
  const site = getSiteUrl();
  const url = absoluteUrl(path, site);
  const ogTitle = title ? `${title} | ${business.shortName}` : `${business.shortName} — ${business.tagline}`;
  const ogImage = absoluteUrl(OG_IMAGE, site);

  return {
    ...(title ? { title } : {}),
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: "website",
      locale: "en_LK",
      siteName: business.shortName,
      title: ogTitle,
      description,
      ...(url ? { url } : {}),
      ...(ogImage
        ? {
            images: [{ url: ogImage, width: 1200, height: 630, alt: `${business.shortName} logo` }],
          }
        : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
