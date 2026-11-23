"use client";

import Image from "next/image";
import { useBrands } from "@/lib/live-taxonomy";
import { TaxonomyNotice } from "./TaxonomyStates";
import { useT } from "@/i18n/I18nProvider";

/**
 * Our Brands. With the live API: the ACTIVE brands staff manage in the Admin
 * dashboard (no rebuild). Each brand shows, in order: the logo staff uploaded
 * (stored losslessly by the API), the ORIGINAL logo file supplied by the
 * client for that brand (public/brands/), or simply its name — a logo is never
 * generated. Logos are object-contain: never stretched, recoloured or cropped.
 * Cards in a centred grid (one brand → one centred card; many → as many per row as fit).
 */
const bundledHeight: Record<string, string> = {
  "pe-plus": "h-12 sm:h-16",
  swisstek: "h-11 sm:h-[3.75rem]",
  "el-toro": "h-16 sm:h-20",
  // The original file has wide white padding around a small wordmark.
  wurth: "h-24 sm:h-28",
};

export function BrandLogos() {
  const { items, status, retry } = useBrands();
  const t = useT();
  if (status === "empty" || status === "error") {
    return (
      <div data-taxonomy-status={status}>
        <TaxonomyNotice status={status} kind="brands" onRetry={retry} />
      </div>
    );
  }
  if (status === "loading") {
    return (
      <ul
        data-taxonomy-status="loading"
        aria-busy="true"
        className="brand-grid mt-8 grid justify-center gap-4 sm:gap-6"
      >
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            aria-hidden="true"
            className="flex min-h-40 items-center justify-center rounded-2xl border border-line/70 bg-white"
          >
            <span className="h-12 w-28 rounded-lg bg-cream-deep motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul data-taxonomy-status={status} className="brand-grid mt-8 grid justify-center gap-4 sm:gap-6">
      {items.map((b) => (
        <li key={b.slug} className="min-w-0">
          <div className="group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-line/70 bg-white px-5 pt-6 pb-5 text-center shadow-[0_8px_24px_-18px_rgb(7_46_29/0.45)] transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:border-brass/60 hover:shadow-[var(--shadow-card)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest via-brass to-gold-soft"
            />
            <div className="flex h-20 w-full items-center justify-center sm:h-24">
              {b.logo?.uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by the website API (Supabase Storage via the API)
                <img
                  src={b.logo.src}
                  alt={t("{name} logo", { name: b.name })}
                  width={b.logo.width}
                  height={b.logo.height}
                  loading="lazy"
                  decoding="async"
                  className="max-h-full w-auto max-w-full object-contain"
                />
              ) : b.logo ? (
                <Image
                  src={b.logo.src}
                  alt={t("{name} logo", { name: b.name })}
                  width={b.logo.width}
                  height={b.logo.height}
                  unoptimized
                  className={`w-auto max-w-full object-contain ${bundledHeight[b.slug] ?? "h-14 sm:h-16"} max-h-full`}
                />
              ) : (
                // No logo uploaded yet: a neat monogram (never a generated logo).
                <span
                  aria-hidden="true"
                  className="inline-flex size-16 items-center justify-center rounded-full bg-forest font-display text-2xl font-semibold text-gold-soft"
                >
                  {b.name.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="mt-4 block w-full font-semibold [overflow-wrap:anywhere] text-forest">{b.name}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
