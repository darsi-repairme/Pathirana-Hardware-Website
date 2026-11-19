"use client";

import Image from "next/image";
import { useBrands } from "@/lib/live-taxonomy";
import { TaxonomyNotice } from "./TaxonomyStates";

/**
 * Our Brands. With the live API: the ACTIVE brands staff manage in the Admin
 * dashboard (no rebuild). Each brand shows, in order: the logo staff uploaded
 * (stored losslessly by the API), the ORIGINAL logo file supplied by the
 * client for that brand (public/brands/), or simply its name — a logo is never
 * generated. Logos are object-contain: never stretched, recoloured or cropped.
 * Desktop/tablet: one row split by gold hairlines; phones: 2 per row.
 */
const bundledHeight: Record<string, string> = {
  "pe-plus": "h-12 sm:h-16",
  swisstek: "h-11 sm:h-[3.75rem]",
  "el-toro": "h-16 sm:h-20",
  // The original file has wide white padding around a small wordmark.
  wurth: "h-24 sm:h-28",
};

const cols: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

export function BrandLogos() {
  const { items, status, retry } = useBrands();
  if (status === "empty" || status === "error") {
    return (
      <div data-taxonomy-status={status}>
        <TaxonomyNotice status={status} kind="brands" onRetry={retry} />
      </div>
    );
  }
  if (status === "loading") {
    return (
      <ul data-taxonomy-status="loading" aria-busy="true" className="brand-row grid grid-cols-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} aria-hidden="true" className="flex min-h-28 items-center justify-center px-4 py-4 sm:min-h-32">
            <span className="h-12 w-28 rounded-lg bg-cream-deep motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul
      data-taxonomy-status={status}
      className={`brand-row grid grid-cols-2 ${cols[items.length] ?? "sm:grid-cols-4"} ${
        items.length === 1 ? "max-sm:grid-cols-1" : ""
      }`}
    >
      {items.map((b) => (
        <li key={b.slug} className="flex min-h-28 items-center justify-center px-4 py-4 sm:min-h-32">
          {b.logo?.uploaded ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by the website API (no build-time image pipeline)
            <img
              src={b.logo.src}
              alt={`${b.name} logo`}
              width={b.logo.width}
              height={b.logo.height}
              loading="lazy"
              decoding="async"
              className="h-14 w-auto max-w-full object-contain sm:h-16"
            />
          ) : b.logo ? (
            <Image
              src={b.logo.src}
              alt={`${b.name} logo`}
              width={b.logo.width}
              height={b.logo.height}
              unoptimized
              className={`w-auto max-w-full object-contain ${bundledHeight[b.slug] ?? "h-14 sm:h-16"}`}
            />
          ) : (
            <span className="text-center font-display text-2xl font-semibold [overflow-wrap:anywhere] text-forest sm:text-[1.7rem]">
              {b.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
