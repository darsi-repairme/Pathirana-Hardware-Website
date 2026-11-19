"use client";

import { useId, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { images } from "@/lib/images";
import { useCategories } from "@/lib/live-taxonomy";
import { CategoryVisual, CategoryIcon } from "./CategoryVisual";
import { TaxonomyNotice } from "./TaxonomyStates";

/**
 * Products page › Browse by Category — compact, image-led tiles for the ACTIVE
 * categories (live from the website API when available; the seven documented
 * categories otherwise). Each tile opens its category page.
 *
 * "View All Categories" (top-right of the heading row on desktop, under the
 * heading on smaller screens) expands the collection in place — there is no
 * separate category index route. Collapsed, the first four show (one row on
 * tablet/desktop, 2 × 2 on phones); expanded, all of them. All links are
 * always in the HTML (collapsed tiles are only hidden).
 *
 * Artwork for this page only (the Home page keeps its own category visuals);
 * a staff-uploaded category image takes precedence, then an icon card.
 */
const tileImage: Record<string, { key: keyof typeof images; crop: string }> = {
  "building-materials": { key: "cementBags", crop: "object-[55%_50%]" },
  "steel-products": { key: "torBars", crop: "object-[35%_55%]" },
  plywood: { key: "plywood", crop: "object-[45%_60%]" },
  "doors-windows": { key: "doorsWindows", crop: "object-[50%_55%]" },
  "bathroom-sanitary": { key: "bathroomSets", crop: "object-[45%_45%]" },
  "gas-cylinders": { key: "gasCylinders", crop: "object-[55%_55%]" },
  "branded-hardware": { key: "toolsHardware", crop: "object-[45%_50%]" },
};

const COLLAPSED = 4;

export function CategoryShowcase({ heading }: { heading: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const { items, status, retry } = useCategories();
  const listId = useId();

  return (
    <>
      <div className="grid items-end gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <span aria-hidden="true" className="hidden lg:block" />
        {heading}
        {items.length > COLLAPSED ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((v) => !v)}
            className="group inline-flex min-h-11 items-center gap-2 justify-self-center rounded-full px-3 font-semibold text-forest transition-colors hover:text-brass-ink lg:justify-self-end"
          >
            {expanded ? "Show Fewer Categories" : "View All Categories"}
            <ArrowRight
              aria-hidden="true"
              className={`size-4 transition-transform duration-300 motion-reduce:transition-none ${
                expanded ? "-rotate-90" : "group-hover:translate-x-1"
              }`}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="hidden lg:block" />
        )}
      </div>

      {/* Phones: 2 columns (the 7th tile spans both); sm+: 4 columns, the last
          row centred. */}
      {status === "empty" || status === "error" ? (
        <div data-taxonomy-status={status} className="mt-8 lg:mt-10">
          <TaxonomyNotice status={status} kind="categories" onRetry={retry} />
        </div>
      ) : null}
      <ul
        id={listId}
        data-taxonomy-status={status}
        aria-busy={status === "loading" || undefined}
        hidden={status === "empty" || status === "error"}
        className="mt-8 flex flex-wrap justify-center gap-3 sm:gap-4 lg:mt-10"
      >
        {status === "loading"
          ? [0, 1, 2, 3].map((i) => (
              <li
                key={i}
                aria-hidden="true"
                className="category-tile aspect-[4/5] rounded-2xl bg-forest/10 motion-safe:animate-pulse lg:aspect-[16/11]"
              />
            ))
          : null}
        {items.map((c, i) => {
          const tile = c.image?.kind === "uploaded" ? null : tileImage[c.slug];
          // An odd last tile spans both columns on phones.
          const last = i === items.length - 1 && items.length % 2 === 1;
          const hidden = !expanded && i >= COLLAPSED;
          return (
            <li
              key={c.slug}
              hidden={hidden}
              className={`category-tile min-w-0 ${expanded && i >= COLLAPSED ? "fade-enter" : ""}`}
            >
              <Link
                href={c.href}
                className={`zoom-img group relative flex h-full flex-col justify-end overflow-hidden rounded-2xl bg-forest-900 shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                  last ? "aspect-[4/5] max-sm:aspect-[2/1] lg:aspect-[16/11]" : "aspect-[4/5] lg:aspect-[16/11]"
                }`}
              >
                {tile ? (
                  <Image
                    src={images[tile.key].src}
                    alt=""
                    fill
                    quality={85}
                    sizes="(min-width: 1024px) 24vw, (min-width: 640px) 25vw, 50vw"
                    className={`object-cover ${tile.crop}`}
                  />
                ) : (
                  <CategoryVisual
                    category={{ slug: c.slug, image: c.image?.kind === "uploaded" ? { ...c.image, alt: "" } : null }}
                    sizes="(min-width: 1024px) 24vw, (min-width: 640px) 25vw, 50vw"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-forest-900 via-forest-900/45 to-transparent"
                />
                <span className="relative flex items-end gap-2 p-3 sm:p-4">
                  <CategoryIcon slug={c.slug} strokeWidth={1.7} className="mb-0.5 size-5 shrink-0 text-gold-soft" />
                  <span className="font-display text-[1.02rem] leading-tight font-semibold text-white sm:text-lg">
                    {c.title}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
