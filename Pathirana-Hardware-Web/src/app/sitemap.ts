import type { MetadataRoute } from "next";
import { allPages } from "@/content/navigation";
import { productCategories, productTypes } from "@/content/products";
import { services } from "@/content/services";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

/**
 * Lists the public pages, including every statically generated product,
 * category and service page. Entries are only emitted when
 * NEXT_PUBLIC_SITE_URL is configured — a sitemap must use absolute URLs and we
 * must not publish a guessed domain.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  if (!site) return [];
  const detail = [
    ...productCategories.map((c) => `/products/categories/${c.id}/`),
    ...productTypes.map((p) => `/products/${p.slug}/`),
    ...services.map((s) => `/services/${s.id}/`),
  ];
  return [
    ...allPages.map((item) => ({
      url: absoluteUrl(item.href, site)!,
      changeFrequency: "monthly" as const,
      priority: item.href === "/" ? 1 : 0.8,
    })),
    ...detail.map((path) => ({
      url: absoluteUrl(path, site)!,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
