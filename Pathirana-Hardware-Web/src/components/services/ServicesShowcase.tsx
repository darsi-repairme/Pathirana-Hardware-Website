"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { services } from "@/content/services";
import { serviceIcons } from "@/components/services/ServiceIcon";
import { ServiceVisual } from "@/components/home/ServiceVisual";
import { useAutoAdvance } from "@/lib/useAutoAdvance";
import { ServiceActions } from "./ServiceActions";

const COUNT = services.length;
/** Same approved timing as the Home ring. */
const AUTO_MS = 6000;
const SWIPE_PX = 40;
const wrap = (n: number) => ((n % COUNT) + COUNT) % COUNT;

/**
 * Services page — one circular 360° display (CEO design requirement).
 *
 * A forest-green disc inside a brass-gold ring. The six services sit on the
 * ring as icon markers; the ring turns so the active marker comes to the top,
 * and the matching 3D object (the existing service scenes, turning slowly
 * through 360°) rotates into the centre of the disc while the previous one
 * turns away. One service is shown at a time with its name, a short
 * description, View Service and Enquire.
 *
 * Controls: Previous / Next, the six ring markers (also the active
 * indicator), ←/→ keys, swipe/drag on the disc, and Play / Pause. Autoplay
 * uses the shared useAutoAdvance hook (6 s, pauses on hover, keyboard focus,
 * off-screen, hidden tab and drag; a manual pause holds until Play; never
 * under prefers-reduced-motion). Phones get the same circle, scaled down.
 */
export function ServicesShowcase() {
  const [turn, setTurn] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const active = wrap(turn);

  const step = (d: number) => setTurn((t) => t + d);
  const select = (i: number) => {
    // Shortest way round: −2…+3 steps.
    const d = wrap(i - active + 2) - 2;
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
    window.setTimeout(() => setDragging(false), 0);
  };

  const current = services[active]!;
  const CurrentIcon = serviceIcons[current.icon];

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
      className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20"
    >
      <p className="sr-only" aria-live={autoplaying ? "off" : "polite"} aria-atomic="true">
        Service {active + 1} of {COUNT}: {current.title}
      </p>

      {/* ── The circular display ── */}
      <div
        className={`services-orbit touch-pan-y select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ "--turn": turn } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div aria-hidden="true" className="services-orbit-disc" />
        {/* 3D objects: the active one faces front; the others are turned away. */}
        <div aria-hidden="true" className="services-orbit-stage">
          {services.map((s, i) => {
            const rel = wrap(i - active);
            const state = rel === 0 ? "on" : rel <= 2 ? "next" : "prev";
            return (
              <div key={s.id} className="services-orbit-visual" data-state={state}>
                <ServiceVisual kind={s.kind} icon={s.icon} active={rel === 0} spin className="size-full" />
              </div>
            );
          })}
        </div>
        {/* Ring markers — one per service; the ring turns the active one to the top. */}
        <ul className="services-orbit-ring">
          {services.map((s, i) => {
            const Icon = serviceIcons[s.icon];
            const on = i === active;
            return (
              <li key={s.id} className="services-orbit-node" style={{ "--i": i } as CSSProperties}>
                <button
                  type="button"
                  onClick={() => select(i)}
                  aria-current={on ? "true" : undefined}
                  className={`inline-flex size-full items-center justify-center rounded-full border-2 transition-[background-color,border-color,color,box-shadow] duration-500 ${
                    on
                      ? "border-gold-soft bg-gradient-to-br from-gold-soft to-brass text-forest-900 shadow-[0_0_22px_rgb(232_190_79/0.65)]"
                      : "border-gold-soft/60 bg-forest-900 text-gold-soft hover:border-gold-soft hover:bg-forest-800"
                  }`}
                >
                  <Icon aria-hidden="true" strokeWidth={1.7} className="size-[45%]" />
                  <span className="sr-only">Show {s.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Active service details ── */}
      <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
        <div key={active} className="fade-enter">
          <p className="text-xs font-semibold tracking-[0.22em] text-brass-ink uppercase">
            Service {String(active + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
          </p>
          {/* h2: the showcase sits directly under the page h1 (/services/). */}
          <h2 className="mt-3 flex items-center justify-center gap-3 font-display text-[clamp(1.6rem,6vw,2.35rem)] leading-tight font-semibold text-forest lg:justify-start">
            <CurrentIcon aria-hidden="true" strokeWidth={1.6} className="size-7 shrink-0 text-brass" />
            {current.title}
          </h2>
          <span
            aria-hidden="true"
            className="mx-auto mt-4 block h-0.5 w-14 bg-gradient-to-r from-brass to-gold-soft lg:mx-0"
          />
          <p className="mt-4 min-h-[3.5em] text-lg leading-relaxed text-ink-muted">{current.summary}</p>
          <ServiceActions service={current} className="mx-auto mt-6 max-w-md lg:mx-0" />
        </div>

        {/* Previous · Next · Play/Pause */}
        <div className="mt-8 flex items-center justify-center gap-2 lg:justify-start">
          <button
            type="button"
            onClick={() => step(-1)}
            className="inline-flex size-11 items-center justify-center rounded-full border border-forest/30 text-forest transition-colors hover:border-brass hover:bg-white"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
            <span className="sr-only">Previous service</span>
          </button>
          <span aria-hidden="true" className="w-16 text-center text-sm font-semibold tracking-[0.16em] text-brass-ink">
            {String(active + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            className="inline-flex size-11 items-center justify-center rounded-full border border-forest/30 text-forest transition-colors hover:border-brass hover:bg-white"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
            <span className="sr-only">Next service</span>
          </button>
          <button
            type="button"
            onClick={() => setUserPaused((v) => !v)}
            className="ml-2 inline-flex size-11 items-center justify-center rounded-full bg-forest text-gold-soft transition-colors hover:bg-forest-800 motion-reduce:hidden"
          >
            {userPaused ? (
              <Play aria-hidden="true" className="size-4 fill-current" />
            ) : (
              <Pause aria-hidden="true" className="size-4 fill-current" />
            )}
            <span className="sr-only">{userPaused ? "Play service rotation" : "Pause service rotation"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
