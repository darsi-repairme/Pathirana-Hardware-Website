"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import type { ReactNode } from "react";
import type { GalleryImage } from "@/content/gallery";

type Props = {
  images: GalleryImage[];
  /** Optional extra tile rendered after the photos (e.g. "more coming soon"). */
  trailing?: ReactNode;
  /**
   * "feature": every 7th tile is large; "even": uniform tiles; "collage": an
   * editorial asymmetric collage (one large feature tile per eight, alternating
   * sides) with captions over the images.
   */
  layout?: "feature" | "even" | "collage";
  /** Small label on each thumbnail, e.g. "Illustration". */
  badge?: string;
};

/**
 * Responsive gallery with an accessible lightbox.
 * - Native <dialog>: focus trap, Escape closes, background inert.
 * - Arrow keys / buttons / swipe move between images.
 * - Focus returns to the thumbnail that opened the lightbox.
 */
/**
 * Collage tile spans. Images come in segments of eight: one large feature tile
 * (alternating left/right on lg) and up to seven smaller ones. The last tiles of
 * an incomplete segment widen so no row is left with an empty gap.
 * Phones: 2 columns · sm: 6 · lg: 12.
 */
const LG_A = { 1: "lg:col-span-6 lg:row-span-2", 2: "lg:col-span-6", 3: "lg:col-span-3", 4: "lg:col-span-3" } as const;
const LG_B = { 1: "lg:col-span-12", 2: "lg:col-span-6", 3: "lg:col-span-4" } as const;
function collageTile(i: number, n: number) {
  const start = i - (i % 8);
  const right = (start / 8) % 2 === 1;
  if (i === start) {
    return `col-span-2 row-span-2 sm:col-span-6 lg:col-span-6 ${right ? "lg:col-start-7" : ""}`;
  }
  const j = i - start - 1; // 0…6
  const m = Math.min(7, n - start - 1); // smaller tiles in this segment
  // Phones / sm: two per row; a lone last tile spans the row.
  const small = j === m - 1 && m % 2 === 1 ? "col-span-2 sm:col-span-6" : "sm:col-span-3";
  let lg: string;
  if (j < 4) {
    const a = Math.min(4, m) as 1 | 2 | 3 | 4;
    lg = a === 3 && j === 2 ? "lg:col-span-6" : LG_A[a];
  } else {
    lg = LG_B[Math.min(3, m - 4) as 1 | 2 | 3];
  }
  return `${small} ${lg}`;
}

export function GalleryGrid({ images, trailing, layout = "feature", badge }: Props) {
  const collage = layout === "collage";
  const big = (i: number) => (layout === "feature" && i % 7 === 0) || (collage && i % 8 === 0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const count = images.length;
  const current = index !== null ? images[index] : undefined;

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };

  const close = useCallback(() => dialogRef.current?.close(), []);

  const step = useCallback((delta: number) => setIndex((i) => (i === null ? i : (i + delta + count) % count)), [count]);

  // When the dialog closes (button, Escape or backdrop), restore focus.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      setIndex((i) => {
        if (i !== null) triggerRefs.current[i]?.focus();
        return null;
      });
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <>
      <ul
        className={
          collage
            ? "grid grid-flow-dense auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-6 md:gap-4 lg:auto-rows-[13.5rem] lg:grid-cols-12"
            : `grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:gap-4 ${layout === "even" && count === 2 ? "" : "md:grid-cols-3"} ${layout === "even" && count % 4 === 0 ? "lg:grid-cols-4" : ""}`
        }
      >
        {images.map((img, i) => (
          <li
            key={img.id}
            className={
              collage ? `min-w-0 ${collageTile(i, count)}` : big(i) ? "min-[480px]:col-span-2 md:row-span-2" : ""
            }
          >
            <figure className="flex h-full flex-col">
              <button
                ref={(el) => {
                  triggerRefs.current[i] = el;
                }}
                type="button"
                onClick={() => open(i)}
                className={`group relative block w-full flex-1 overflow-hidden rounded-[var(--radius-card)] bg-cream-deep shadow-[var(--shadow-card)] ${collage ? "h-full" : "aspect-[4/3]"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static export with pre-sized responsive files */}
                <img
                  src={img.src}
                  srcSet={img.srcSet}
                  sizes={
                    collage
                      ? big(i)
                        ? "(min-width: 1024px) 50vw, (min-width: 640px) 66vw, 100vw"
                        : "(min-width: 1024px) 34vw, (min-width: 640px) 33vw, 50vw"
                      : big(i)
                        ? "(min-width: 768px) 66vw, 100vw"
                        : "(min-width: 768px) 33vw, (min-width: 480px) 50vw, 100vw"
                  }
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  loading={i < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.04] motion-reduce:transition-none"
                />
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 bg-gradient-to-t from-forest-900/60 via-transparent to-transparent transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 ${collage && img.caption ? "opacity-100" : "opacity-0"}`}
                />
                {collage && img.caption ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-14 bottom-3 left-3 text-left text-sm leading-snug font-semibold text-white sm:bottom-4 sm:left-4"
                  >
                    {img.caption}
                  </span>
                ) : null}
                <span
                  aria-hidden="true"
                  className="absolute right-3 bottom-3 inline-flex size-10 translate-y-2 items-center justify-center rounded-full bg-white text-forest opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                >
                  <Expand className="size-4" />
                </span>
                {(img.badge ?? badge) ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-3 left-3 rounded-full bg-forest-900/85 px-2.5 py-1 text-xs font-medium text-cream/90"
                  >
                    {img.badge ?? badge}
                  </span>
                ) : null}
                <span className="sr-only">View larger image</span>
              </button>
              {img.caption ? (
                <figcaption className={collage ? "sr-only" : "mt-2 text-sm text-ink-muted"}>{img.caption}</figcaption>
              ) : null}
            </figure>
          </li>
        ))}
        {trailing ? <li className="md:row-span-2">{trailing}</li> : null}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label="Image viewer"
        onKeyDown={onKeyDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          const end = e.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start === null || end === undefined) return;
          const dx = end - start;
          if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        }}
        className="ph-dialog m-auto h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-white backdrop:bg-forest-900/95"
      >
        {current ? (
          <div className="flex h-full flex-col" onClick={(e) => e.target === e.currentTarget && close()}>
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <p className="text-sm text-sage" aria-live="polite">
                Image {index! + 1} of {count}
              </p>
              <button
                type="button"
                onClick={close}
                autoFocus
                className="on-dark inline-flex size-12 items-center justify-center rounded-full text-white hover:bg-white/10"
              >
                <X aria-hidden="true" className="size-6" />
                <span className="sr-only">Close image viewer</span>
              </button>
            </div>

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-20"
              onClick={(e) => e.target === e.currentTarget && close()}
            >
              <figure className="flex max-h-full flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- static export with pre-sized responsive files */}
                <img
                  key={current.id}
                  src={current.src}
                  srcSet={current.srcSet}
                  sizes="100vw"
                  alt={current.alt}
                  width={current.width}
                  height={current.height}
                  className="fade-enter max-h-[calc(100dvh-9rem)] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                />
                {current.caption ? (
                  <figcaption className="mt-3 px-4 text-center text-sm text-sage">{current.caption}</figcaption>
                ) : null}
              </figure>

              {count > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="on-dark absolute top-1/2 left-2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white hover:bg-white/15 sm:left-4"
                  >
                    <ChevronLeft aria-hidden="true" className="size-6" />
                    <span className="sr-only">Previous image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="on-dark absolute top-1/2 right-2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white hover:bg-white/15 sm:right-4"
                  >
                    <ChevronRight aria-hidden="true" className="size-6" />
                    <span className="sr-only">Next image</span>
                  </button>
                </>
              ) : null}
            </div>
            <div className="h-6" />
          </div>
        ) : null}
      </dialog>
    </>
  );
}
