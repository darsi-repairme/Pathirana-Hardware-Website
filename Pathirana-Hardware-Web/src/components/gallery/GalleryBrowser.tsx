"use client";

import { useMemo, useState } from "react";
import type { GalleryImage } from "@/content/gallery";
import { GalleryGrid } from "./GalleryGrid";
import { useDynamicText, useT } from "@/i18n/I18nProvider";
import { toGalleryImage, useLiveGallery } from "@/lib/live-gallery";

type Group = { id: string; title: string; images: GalleryImage[] };

/**
 * Gallery: compact filter chips (only groups that have images) above one editorial collage with a
 * shared lightbox. The Admin Gallery (live database) is the ONLY source: staff upload, edit, hide,
 * reorder and delete there, and nothing else appears — no images bundled with the site.
 */
export function GalleryBrowser() {
  const [active, setActive] = useState<string>("all");
  const live = useLiveGallery();
  const pick = useDynamicText();
  const t = useT();
  // Photos published in the Admin, grouped by the staff's collection name.
  const groups = useMemo(() => {
    const byName = new Map<string, Group>();
    for (const p of live.photos) {
      const name = p.collection?.trim() || "Latest photos";
      const id = `live:${name.toLowerCase()}`;
      let g = byName.get(id);
      if (!g) {
        g = { id, title: t(name), images: [] };
        byName.set(id, g);
      }
      const caption = p.caption ? pick(p.caption, p.translations, "caption") : pick(p.title, p.translations, "title");
      g.images.push(toGalleryImage(p, live.base, { alt: pick(p.altText, p.translations, "altText"), caption }));
    }
    return [...byName.values()].filter((g) => g.images.length > 0);
  }, [live.photos, live.base, pick, t]);
  const shown = active === "all" ? groups : groups.filter((c) => c.id === active);
  const images = shown.flatMap((g) => g.images);

  if (live.status === "error")
    return (
      <div data-gallery-status="error" role="alert" className="mt-2 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-ink-muted">{t("The gallery could not be loaded. Please try again.")}</p>
        <button
          type="button"
          onClick={live.retry}
          className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold text-forest hover:border-brass"
        >
          {t("Try again")}
        </button>
      </div>
    );

  if (live.status === "loading")
    return (
      <div data-gallery-status="loading" aria-busy="true" className="mt-2">
        <p role="status" className="text-center text-sm text-ink-muted">
          {t("Loading gallery…")}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} aria-hidden="true" className="aspect-[4/3] animate-pulse rounded-2xl bg-cream-deep" />
          ))}
        </div>
      </div>
    );

  if (groups.length === 0)
    return (
      <p data-gallery-status="empty" className="mt-2 text-center text-sm text-ink-muted">
        {t("New photos of our store will appear here soon.")}
      </p>
    );

  return (
    <div data-gallery-status="managed">
      {groups.length > 1 ? (
        <div role="group" aria-label={t("Filter gallery")} className="flex flex-wrap justify-center gap-2">
          {[{ id: "all", title: t("All") }, ...groups.map((g) => ({ ...g, title: t(g.title) }))].map((g) => {
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
        <span>
          {images.length === 1 ? t("1 image in our gallery.") : t("{n} images in our gallery.", { n: images.length })}
        </span>
      </p>

      <div className="mt-8">
        {/* Re-mounted per filter so the lightbox always pages through what is shown. */}
        <GalleryGrid key={active} images={images} layout="collage" />
      </div>
    </div>
  );
}
