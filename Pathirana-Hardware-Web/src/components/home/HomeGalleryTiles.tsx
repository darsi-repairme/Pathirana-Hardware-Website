"use client";

import Link from "next/link";
import { T, useDynamicText, useT } from "@/i18n/I18nProvider";
import { toGalleryImage, useLiveGallery } from "@/lib/live-gallery";

/** Collage shapes: phones = a swipeable, staggered strip; sm–md = 6 columns; lg = 12-column editorial. */
const SHAPES = [
  "max-sm:h-72 sm:col-span-4 sm:row-span-2 lg:col-span-5 lg:row-span-2",
  "max-sm:mt-8 max-sm:h-60 sm:col-span-2 lg:col-span-4",
  "max-sm:h-72 sm:col-span-2 lg:col-span-3",
  "max-sm:mt-8 max-sm:h-60 sm:col-span-3 lg:col-span-3",
  "max-sm:h-72 sm:col-span-3 lg:col-span-4",
] as const;
const DELAYS = ["d1", "d2", "d3", "d4", "d5"];
const LIST =
  "gallery-strip -mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:auto-rows-[11rem] sm:grid-cols-6 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:mt-10 lg:auto-rows-[15rem] lg:grid-cols-12";
const ITEM = "w-[72%] shrink-0 snap-start min-[480px]:w-[46%] sm:w-auto";
const LINK =
  "zoom-img group relative block h-full overflow-hidden rounded-[1.25rem] bg-cream-deep shadow-[var(--shadow-card)]";

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-forest-900/70 to-transparent"
      />
      <span className="absolute right-3 bottom-3 left-3 text-sm font-semibold text-white">
        {children}
        <span className="sr-only">
          {" — "}
          <T>open the gallery</T>
        </span>
      </span>
    </>
  );
}

/**
 * Home "Our Gallery" collage. Connected to the API it shows the FIRST FIVE published photos of the
 * Admin Gallery (staff order) — the same source as the Gallery page, so hiding, deleting, replacing or
 * reordering a photo in the Admin changes the home page too. While loading: placeholder tiles (never
 * images that may have been hidden). No published photos, or the API is unreachable: a short note.
 * No images bundled with the site are used.
 */
export function HomeGalleryTiles() {
  const live = useLiveGallery();
  const pick = useDynamicText();
  const t = useT();

  if (live.status === "loading")
    return (
      <ul className={LIST} data-home-gallery="loading" aria-busy="true">
        {SHAPES.map((shape, i) => (
          <li key={i} aria-hidden="true" className={`${ITEM} ${shape}`}>
            <span className="block h-full animate-pulse rounded-[1.25rem] bg-cream-deep" />
          </li>
        ))}
      </ul>
    );

  const photos = live.status === "live" ? live.photos.slice(0, SHAPES.length) : [];
  if (photos.length === 0)
    return (
      <p data-home-gallery={live.status === "error" ? "error" : "empty"} className="mt-8 text-ink-muted">
        {live.status === "error"
          ? t("The gallery could not be loaded. Please try again.")
          : t("New photos of our store will appear here soon.")}
      </p>
    );

  return (
    <ul className={LIST} data-home-gallery="live">
      {photos.map((p, i) => {
        const caption = p.caption ? pick(p.caption, p.translations, "caption") : pick(p.title, p.translations, "title");
        const img = toGalleryImage(p, live.base, { alt: pick(p.altText, p.translations, "altText"), caption });
        return (
          <li key={p.id} className={`rv-img ${DELAYS[i]} ${ITEM} ${SHAPES[i]}`}>
            <Link href="/gallery/" className={LINK}>
              {/* eslint-disable-next-line @next/next/no-img-element -- photo served by the API (Admin Gallery) */}
              <img
                src={img.src}
                srcSet={img.srcSet}
                sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 72vw"
                alt={img.alt}
                width={p.width}
                height={p.height}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
              <Caption>{caption}</Caption>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
