import type { MetadataRoute } from "next";
import { allPages } from "@/content/navigation";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

/**
 * Lists the public pages. Products, categories and services come only from the live database
 * (their content loads in the browser), so their individual pages are not listed here — what is
 * published can change at any time without a rebuild. Entries are only emitted when
 * NEXT_PUBLIC_SITE_URL is configured — a sitemap must use absolute URLs and we must not publish
 * a guessed domain.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  if (!site) return [];
  const detail = ["/services/all/"];
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
