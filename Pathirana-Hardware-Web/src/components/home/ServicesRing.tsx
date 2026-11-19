"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { services } from "@/content/services";
import { serviceIcons } from "@/components/services/ServiceIcon";
import { useAutoAdvance } from "@/lib/useAutoAdvance";
import { ServiceVisual } from "./ServiceVisual";

const COUNT = services.length;
/** Time to read the facing service before the ring turns on (CEO review). */
const AUTO_MS = 6000;
const SWIPE_PX = 40;

/** Ring position (0–5) of a continuous turn counter. */
const wrap = (n: number) => ((n % COUNT) + COUNT) % COUNT;

/**
 * 360° services ring (CEO review #09) — CSS 3D, no extra WebGL or libraries.
 *
 * The six approved services sit around a ring (60° apart); the ring turns so
 * the active service faces the viewer, readable and linked to its details,
 * with its neighbours angled away at either side for depth. Cards further
 * round are hidden (backface + opacity), so text never overlaps.
 *
 * Controls: Previous / Next, one button per service, ←/→ keys, swipe/drag,
 * clicking a side card brings it to the front, and Play / Pause. It turns on
 * gently every 6 s only while on screen and not hovered (resumes on leave),
 * keyboard-focused or swiped, and not manually paused (stays paused until
 * Play); never for prefers-reduced-motion (manual, instant turns instead).
 * Touch never depends on hover: a swipe turns the ring and restarts the 6 s.
 * Phones and 320 px screens get the same 3D ring, scaled down (see CSS).
 *
 * The turn counter is unbounded, so the ring always takes the short way round
 * and keeps turning in one direction past the sixth service.
 */
export function ServicesRing() {
  const [turn, setTurn] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const active = wrap(turn);

  const step = (d: number) => setTurn((t) => t + d);
  const select = (i: number) => {
    // Shortest way round: −2…+3 steps.
    const d = wrap(i - active + Math.floor(COUNT / 2) - 1) - (Math.floor(COUNT / 2) - 1);
    if (d) step(d);
  };

  const autoplaying = useAutoAdvance(region, {
    delay: AUTO_MS,
    onAdvance: () => step(1),
    step: turn,
    hold: dragging || userPaused,
  });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || d.moved) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      drag.current = null; // vertical page scroll
      return;
    }
    if (Math.abs(dx) > 8) {
      d.moved = true;
      setDragging(true);
    }
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    const dx = e.clientX - d.x;
    if (dx <= -SWIPE_PX) step(1);
    else if (dx >= SWIPE_PX) step(-1);
    // Let the click that ends a drag be swallowed before releasing the hold.
    window.setTimeout(() => setDragging(false), 0);
  };

  const current = services[active]!;

  return (
    <div
      ref={region}
      role="group"
      aria-roledescription="carousel"
      aria-label="Our services"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
    >
      <p className="sr-only" aria-live={autoplaying ? "off" : "polite"} aria-atomic="true">
        Service {active + 1} of {COUNT}: {current.title}
      </p>

      <div
        className={`services-ring-stage touch-pan-y select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="services-ring" style={{ "--turn": turn } as CSSProperties}>
          {services.map((s, i) => {
            const Icon = serviceIcons[s.icon];
            const isActive = i === active;
            // Ring distance from the front (0 = facing, 1 = neighbour, …).
            const dist = Math.min(wrap(i - active), wrap(active - i));
            return (
              <div
                key={s.id}
                className="services-ring-card"
                data-dist={dist}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${COUNT}: ${s.shortTitle}`}
                aria-hidden={!isActive}
              >
                <Link
                  href={`/services/${s.id}/`}
                  tabIndex={isActive ? 0 : -1}
                  draggable={false}
                  data-three-hover
                  onClick={(e: MouseEvent) => {
                    if (dragging) e.preventDefault();
                    else if (!isActive) {
                      e.preventDefault();
                      select(i);
                    }
                  }}
                  className="group flex h-full flex-col rounded-[var(--radius-card)] border border-gold-soft/25 bg-forest-800 p-4 shadow-[0_24px_50px_-28px_rgb(0_0_0/0.8)] transition-colors duration-300 hover:border-gold-soft/60 sm:p-5"
                >
                  {/* Only the three visible cards animate; the others hold their last frame. */}
                  <ServiceVisual
                    kind={s.kind}
                    icon={s.icon}
                    active={dist <= 1}
                    className="h-32 w-full shrink-0 sm:h-36"
                  />
                  <div className="mt-3 flex items-start gap-2.5">
                    <Icon aria-hidden="true" strokeWidth={1.6} className="mt-0.5 size-6 shrink-0 text-gold-soft" />
                    <h3 className="text-[1.05rem] leading-snug font-semibold text-white sm:text-lg">{s.title}</h3>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-sage">{s.summary}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-gold-soft">
                    View service
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Previous · one button per service · Next */}
      <div className="mt-6 flex items-center justify-center gap-1 sm:mt-8">
        <button
          type="button"
          onClick={() => step(-1)}
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-gold-soft hover:text-gold-soft"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Previous service</span>
        </button>
        <div className="mx-1 flex items-center">
          {services.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => select(i)}
              aria-current={i === active ? "true" : undefined}
              className="group inline-flex size-8 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={`block h-2 rounded-full transition-[width,background-color] duration-500 ${
                  i === active ? "w-6 bg-gold-soft" : "w-2 bg-white/45 group-hover:bg-white"
                }`}
              />
              <span className="sr-only">Show {s.title}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-gold-soft hover:text-gold-soft"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
          <span className="sr-only">Next service</span>
        </button>
        <button
          type="button"
          onClick={() => setUserPaused((v) => !v)}
          className="ml-1 inline-flex size-11 items-center justify-center rounded-full border border-gold-soft/40 text-gold-soft transition-colors hover:border-gold-soft hover:bg-white/5 motion-reduce:hidden"
        >
          {userPaused ? (
            <Play aria-hidden="true" className="size-4 fill-current" />
          ) : (
            <Pause aria-hidden="true" className="size-4 fill-current" />
          )}
          <span className="sr-only">{userPaused ? "Play service rotation" : "Pause service rotation"}</span>
        </button>
      </div>
      <p aria-hidden="true" className="mt-2 text-center text-xs font-semibold tracking-[0.2em] text-gold-soft/80">
        {String(active + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
      </p>
    </div>
  );
}
