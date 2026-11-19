"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { GalleryCollection } from "@/lib/gallery-collections";
import { GalleryGrid } from "./GalleryGrid";

/**
 * Gallery: compact filter chips (only groups that have images) above one
 * editorial collage with a shared lightbox. Genuine store photographs are
 * labelled "Our store"; everything else is labelled "Illustration".
 */
export function GalleryBrowser({ collections }: { collections: GalleryCollection[] }) {
  const [active, setActive] = useState<string>("all");
  const groups = collections.filter((c) => c.images.length > 0);
  const shown = active === "all" ? groups : groups.filter((c) => c.id === active);
  const images = shown.flatMap((g) =>
    g.images.map((img) => ({ ...img, badge: g.kind === "photo" ? "Our store" : "Illustration" })),
  );
  const hasIllustrations = shown.some((g) => g.kind === "illustration");

  return (
    <div>
      {groups.length > 1 ? (
        <div role="group" aria-label="Filter gallery" className="flex flex-wrap justify-center gap-2">
          {[{ id: "all", title: "All" }, ...groups].map((g) => {
            const on = active === g.id;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => setActive(g.id)}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,color] duration-200 sm:px-5 ${
                  on
                    ? "border-forest bg-forest text-white"
                    : "border-line-strong bg-white text-forest hover:border-brass hover:bg-cream-deep"
                }`}
              >
                {g.title}
              </button>
            );
          })}
        </div>
      ) : null}

      <p aria-live="polite" className="mt-5 flex items-start justify-center gap-2 text-center text-sm text-ink-muted">
        {hasIllustrations ? (
          <>
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brass-ink" />
            <span>{images.length} images. Those marked “Illustration” are artwork, not photographs of our store.</span>
          </>
        ) : (
          <span>{images.length === 1 ? "1 photograph" : `${images.length} photographs`} of our store.</span>
        )}
      </p>

      <div className="mt-8">
        {/* Re-mounted per filter so the lightbox always pages through what is shown. */}
        <GalleryGrid key={active} images={images} layout="collage" />
      </div>
    </div>
  );
}
