"use client";

import Image from "next/image";
import { useCallback, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, MapPin, Pause, Phone, Play, Wrench } from "lucide-react";
import { images } from "@/lib/images";
import { useAutoAdvance } from "@/lib/useAutoAdvance";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

type Slide = {
  image: (typeof images)[keyof typeof images];
  /**
   * object-position for the banner crop. The source banners keep their left
   * ~30–40% empty for desktop copy, so below `lg` (where the image sits under
   * the copy in a taller 4:3 / 3:2 frame) each slide is framed on its own
   * subjects; from `lg` the approved desktop crop is used unchanged.
   */
  position: string;
  eyebrow: string;
  lead: string;
  accent: string;
  text: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string; icon: "map" | "phone" | "wrench" };
};

const SLIDES: Slide[] = [
  {
    image: images.hero,
    // Helmet, bricks and tools span ~31–100% of the width.
    position: "object-[100%_50%] land:object-[78%_50%] lg:object-[78%_50%]",
    eyebrow: "Pathirana Hardware",
    lead: "Your Trusted Partner for",
    accent: "Building & Hardware Needs",
    text: "A wide range of building materials, tools and construction supplies under one roof.",
    primary: { label: "Explore Our Products", href: "/products/" },
    secondary: { label: "Find Our Store", href: "/contact/#find-us", icon: "map" },
  },
  {
    image: images.heroConstruction,
    // Building ~31–86%, excavator ~84–100%.
    position: "object-[96%_50%] land:object-[72%_50%] lg:object-[72%_50%]",
    eyebrow: "Building something new?",
    lead: "Materials for",
    accent: "Your Next Project",
    text: "Find the materials you need for your next project.",
    primary: { label: "Explore Our Products", href: "/products/" },
    secondary: { label: "Contact Us", href: "/contact/", icon: "phone" },
  },
  {
    image: images.heroMaterials,
    // Shelves from ~30%, cement, boards and pipes to the right edge.
    position: "object-[90%_50%] land:object-[70%_50%] lg:object-[70%_50%]",
    eyebrow: "Shop smarter, save bigger!",
    lead: "Everything for Your",
    accent: "Building Needs",
    text: "Explore tools, hardware and building supplies.",
    primary: { label: "Explore Products", href: "/products/" },
    secondary: { label: "Our Services", href: "/services/", icon: "wrench" },
  },
];

const SWIPE_PX = 50;
/** Automatic advance interval (CEO review #04). */
const AUTO_MS = 6000;

const icons = { map: <MapPin />, phone: <Phone />, wrench: <Wrench /> };

/**
 * Homepage hero — a three-slide carousel (WAI-ARIA carousel pattern).
 *
 * Slides are stacked in one grid cell and CROSSFADE (0.7 s), so every change —
 * including 3 → 1 and 1 → 3 — is a single seamless fade, never a sweep across
 * the middle slide. Slides share the tallest slide's height (no layout shift).
 *
 * Autoplay: every 6 s, cycling 1 → 2 → 3 → 1. Pauses while hovered (resumes on
 * leave), while keyboard focus is inside, while swiping, off screen, in a
 * hidden tab, and never runs for prefers-reduced-motion. The Pause button
 * stops it until the visitor presses Play — hover and focus can't override
 * that. Manual navigation (arrows, dots, ←/→ keys, swipe/drag) loops the same
 * way and restarts the 6 s wait. Inactive slides are inert and hidden.
 */
export function Hero() {
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const count = SLIDES.length;
  /** Cycles: past the last slide returns to the first, and vice versa. */
  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const autoplaying = useAutoAdvance(sectionRef, {
    delay: AUTO_MS,
    onAdvance: () => setIndex((i) => (i + 1) % count),
    step: index,
    hold: dragging || userPaused,
  });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a, button, input")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        drag.current = null; // vertical scroll — let the page scroll
        return;
      }
      if (Math.abs(dx) < 8) return;
      d.moved = true;
      setDragging(true);
      try {
        viewport.current?.setPointerCapture(e.pointerId);
      } catch {
        // The pointer may already have ended (e.g. a cancelled touch); the
        // swipe still works without capture.
      }
    }
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    const dx = e.clientX - d.x;
    setDragging(false);
    if (dx <= -SWIPE_PX) goTo(index + 1);
    else if (dx >= SWIPE_PX) goTo(index - 1);
  };

  const slide = SLIDES[index]!;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-title"
      aria-roledescription="carousel"
      className="hero-carousel on-dark relative isolate overflow-hidden bg-forest-900 text-white"
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input")) return;
        if (e.key === "ArrowRight") goTo(index + 1);
        if (e.key === "ArrowLeft") goTo(index - 1);
        if (e.key === "Home") goTo(0);
        if (e.key === "End") goTo(count - 1);
      }}
    >
      {/* Quiet while rotating automatically (WAI-ARIA carousel guidance). */}
      <p className="sr-only" aria-live={autoplaying ? "off" : "polite"} aria-atomic="true">
        Slide {index + 1} of {count}: {slide.lead} {slide.accent}
      </p>

      {/* Slides + swoosh share a box: below lg the swoosh sits on the banner's
          bottom edge, clear of the controls row; from lg (controls absolute) the
          box bottom is the section bottom, as in the approved design. */}
      <div className="relative">
        <div
          ref={viewport}
          className={`touch-pan-y select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(e) => {
            if (dragging) e.preventDefault();
          }}
        >
          <div className="hero-track grid">
            {SLIDES.map((s, i) => {
              const active = i === index;
              const Heading = i === 0 ? "h1" : "h2";
              return (
                <div
                  key={s.image.src}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${count}`}
                  inert={!active}
                  className={`hero-slide relative flex w-full flex-col transition-[opacity,visibility] duration-700 ease-out [grid-area:1/1] ${
                    active ? "is-active visible z-[1] opacity-100" : "invisible opacity-0"
                  }`}
                >
                  {/* Short landscape screens (land:) use the desktop side-by-side composition.
                    Below lg the copy is centred in the space above the banner so
                    shorter slides don't leave a gap above the image. */}
                  <Container
                    size="wide"
                    className="relative z-10 flex flex-1 flex-col justify-center lg:block lg:flex-none land:block land:flex-none"
                  >
                    <div className="hero-intro max-w-xl pt-7 pb-6 sm:pt-11 sm:pb-9 lg:max-w-[31rem] lg:py-24 xl:max-w-[46rem] xl:py-32 land:max-w-[56%] land:pt-8 land:pb-16">
                      <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-white/90 uppercase sm:gap-4 sm:text-sm sm:tracking-[0.32em]">
                        {s.eyebrow}
                        <span
                          aria-hidden="true"
                          className="hero-line hidden h-px w-10 shrink-0 bg-gold-soft min-[360px]:block sm:w-24"
                        />
                      </p>
                      <Heading
                        id={i === 0 ? "hero-title" : undefined}
                        className="mt-3 font-display text-[clamp(2rem,9.2vw,2.6rem)] leading-[1.1] font-semibold tracking-[-0.01em] sm:mt-6 sm:text-[clamp(2.75rem,6vw,3.4rem)] lg:text-[3.1rem] xl:text-[3.9rem] land:mt-3 land:text-[clamp(1.75rem,4.4vw,2.4rem)]"
                      >
                        <span className="hero-mask">
                          <span>{s.lead}</span>
                        </span>{" "}
                        <span className="hero-mask">
                          <span className="text-gold-soft">{s.accent}</span>
                        </span>
                      </Heading>
                      <p className="hero-text mt-3 max-w-md text-base leading-relaxed text-sage sm:mt-6 sm:text-xl land:mt-3 land:text-base">
                        {s.text}
                      </p>
                      <ButtonPair className="hero-actions mt-5 max-w-[31rem] [--pair-min:15rem] sm:mt-9 land:mt-5">
                        <Button href={s.primary.href} variant="gold" arrow="right">
                          {s.primary.label}
                        </Button>
                        <Button href={s.secondary.href} variant="outlineLight" icon={icons[s.secondary.icon]}>
                          {s.secondary.label}
                        </Button>
                      </ButtonPair>
                    </div>
                  </Container>

                  {/* Banner — below the copy on small screens, filling the right-hand side from lg.
                    The 4:3 / 3:2 frame crops the banner's empty left side so the subjects fill it.
                    From lg its left edge is MASKED to transparent: the box starts at a
                    fractional x (58% / 64%), and the anti-aliased first pixel column of
                    the photo showed as a thin light seam against the green. */}
                  <div className="hero-image relative aspect-[4/3] w-full overflow-hidden sm:aspect-[3/2] lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:aspect-auto lg:w-[58%] lg:[mask-image:linear-gradient(to_right,transparent,#000_14%)] xl:w-[64%] land:absolute land:inset-y-0 land:right-0 land:aspect-auto land:w-[54%] land:[mask-image:linear-gradient(to_right,transparent,#000_14%)]">
                    <Image
                      src={s.image.src}
                      alt={s.image.alt}
                      fill
                      preload={i === 0}
                      loading={i === 0 ? undefined : "eager"}
                      fetchPriority={i === 0 ? "high" : "low"}
                      quality={90}
                      draggable={false}
                      sizes="(min-width: 1280px) 64vw, (min-width: 1024px) 58vw, (orientation: landscape) and (max-height: 600px) 54vw, 100vw"
                      className={`hero-depth object-cover ${s.position}`}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-b from-forest-900 via-transparent via-[16%] to-transparent lg:bg-gradient-to-r lg:from-forest-900 lg:via-forest-900/55 lg:via-30% lg:to-transparent lg:to-65% land:bg-gradient-to-r land:from-forest-900 land:via-forest-900/55 land:via-30% land:to-transparent land:to-65%"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Red and gold brand swoosh (decorative), bottom-left as in the approved design.
            Both strokes end beyond the bottom edge, so they run off the banner
            edge instead of stopping in mid-air. */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 300 120"
          fill="none"
          strokeLinecap="round"
          className="hero-swoosh pointer-events-none absolute bottom-0 left-0 z-20 w-[150px] min-[480px]:w-[200px] sm:w-[300px] lg:w-[360px] land:w-[200px]"
        >
          <path pathLength={1} d="M-6 26C60 66 150 104 300 124" stroke="#E3101A" strokeWidth="9" />
          <path pathLength={1} d="M-6 4C76 54 176 96 304 123" stroke="#E8BE4F" strokeWidth="3" />
        </svg>
      </div>

      {/* Controls — in their own row under the banner below lg (never over the
          helmet, tools or buttons); centred over the banner edge from lg. */}
      <div className="relative z-30 mx-auto my-2.5 flex w-fit items-center gap-1 rounded-full bg-forest-900/70 p-1 backdrop-blur sm:my-4 lg:absolute lg:bottom-5 lg:left-1/2 lg:my-0 lg:-translate-x-1/2 land:absolute land:bottom-3 land:left-1/2 land:my-0 land:-translate-x-1/2">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          className="inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Previous slide</span>
        </button>
        <div className="flex items-center">
          {SLIDES.map((s, i) => (
            <button
              key={s.image.src}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === index ? "true" : undefined}
              className="group inline-flex size-8 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={`block h-2.5 rounded-full transition-[width,background-color] duration-500 ease-[var(--ease-out-soft)] ${
                  i === index ? "hero-dot-active w-7 bg-gold-soft" : "w-2.5 bg-white/60 group-hover:bg-white"
                }`}
              />
              <span className="sr-only">
                Show slide {i + 1}: {s.lead} {s.accent}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          className="inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
          <span className="sr-only">Next slide</span>
        </button>
        {/* Play / Pause (hidden for reduced motion, where nothing auto-advances). */}
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-white/20 motion-reduce:hidden" />
        <button
          type="button"
          onClick={() => setUserPaused((v) => !v)}
          className="inline-flex size-11 items-center justify-center rounded-full text-gold-soft transition-colors hover:bg-white/10 motion-reduce:hidden"
        >
          {userPaused ? (
            <Play aria-hidden="true" className="size-4 fill-current" />
          ) : (
            <Pause aria-hidden="true" className="size-4 fill-current" />
          )}
          <span className="sr-only">{userPaused ? "Play slide show" : "Pause slide show"}</span>
        </button>
      </div>
    </section>
  );
}
