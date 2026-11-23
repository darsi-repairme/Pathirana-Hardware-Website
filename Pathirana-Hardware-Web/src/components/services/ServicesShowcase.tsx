"use client";

import { useT } from "@/i18n/I18nProvider";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { approvedOnly, useServiceText, useSiteServices } from "@/lib/live-services";
import { serviceIcons } from "@/components/services/ServiceIcon";
import { ServiceVisual } from "@/components/home/ServiceVisual";
import { useAutoAdvance } from "@/lib/useAutoAdvance";
import { ServiceActions } from "./ServiceActions";

/** Same approved timing as the Home ring. */
const AUTO_MS = 6000;
const SWIPE_PX = 40;

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
  // Published services from the Admin (the approved six until the API answers, or without it).
  const services = approvedOnly(useSiteServices().services);
  const text = useServiceText();
  const COUNT = Math.max(services.length, 1);
  const wrap = (n: number) => ((n % COUNT) + COUNT) % COUNT;
  const [turn, setTurn] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Pointer resting on the circular controls (orbit or the round Previous / Next buttons). */
  const [navHover, setNavHover] = useState(false);
  const hoverOn = (e: PointerEvent<HTMLElement>) => e.pointerType === "mouse" && setNavHover(true);
  const hoverOff = () => setNavHover(false);
  const region = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const active = wrap(turn);

  const step = (d: number) => setTurn((t) => t + d);
  const select = (i: number) => {
    // Shortest way round (−2…+3 steps for six).
    const half = Math.floor(COUNT / 2) - 1;
    const d = wrap(i - active + half) - half;
    if (d) step(d);
  };

  const autoplaying = useAutoAdvance(region, {
    delay: AUTO_MS,
    onAdvance: () => step(1),
    step: turn,
    hold: dragging || navHover,
    pauseOnHover: false,
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

  const current = services[active];
  const t = useT();
  if (!current)
    return (
      <p className="text-center text-lg text-ink-muted">
        {t("Please call or WhatsApp the store to ask about our services.")}
      </p>
    );
  const CurrentIcon = serviceIcons[current.icon];
  const cur = text(current);

  return (
    <div
      ref={region}
      role="group"
      aria-roledescription="carousel"
      aria-label={t("Our services")}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20"
    >
      <p className="sr-only" aria-live={autoplaying ? "off" : "polite"} aria-atomic="true">
        {t("Service {n} of {count}:", { n: active + 1, count: COUNT })} {cur.title}
      </p>

      {/* ── The circular display ── */}
      <div
        className={`services-orbit touch-pan-y select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ "--turn": turn, "--step": `${360 / COUNT}deg` } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={hoverOn}
        onPointerLeave={hoverOff}
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
                  <span className="sr-only">{t("Show {name}", { name: text(s).title })}</span>
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
            <span className="whitespace-nowrap">
              {t("Service")} {String(active + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
            </span>
          </p>
          {/* h2: the showcase sits directly under the page h1 (/services/). */}
          {/* Phones / tablets: icon centred above the (balanced, naturally wrapping) title;
              desktop: icon beside a left-aligned title. */}
          <h2
            data-service-heading
            className="mt-3 flex flex-col items-center gap-2 font-display text-[clamp(1.6rem,6vw,2.35rem)] leading-tight font-semibold text-forest lg:flex-row lg:items-center lg:gap-3"
          >
            <CurrentIcon aria-hidden="true" strokeWidth={1.6} className="size-7 shrink-0 text-brass" />
            <span className="max-w-full min-w-0 [text-wrap:balance]">{cur.title}</span>
          </h2>
          <span
            aria-hidden="true"
            className="mx-auto mt-4 block h-0.5 w-14 bg-gradient-to-r from-brass to-gold-soft lg:mx-0"
          />
          <p className="mt-4 min-h-[3.5em] text-lg leading-relaxed text-ink-muted">{cur.summary}</p>
          <ServiceActions service={current} className="mx-auto mt-6 max-w-md lg:mx-0" />
        </div>

        {/* Previous · counter · Next. Resting the pointer on these round controls (or on the
            orbit) pauses the rotation; it resumes when the pointer leaves. No Pause button. */}
        <div className="mt-8 flex items-center justify-center gap-2 lg:justify-start">
          <button
            type="button"
            onClick={() => step(-1)}
            onPointerEnter={hoverOn}
            onPointerLeave={hoverOff}
            className="inline-flex size-11 items-center justify-center rounded-full border border-forest/30 text-forest transition-colors hover:border-brass hover:bg-white"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
            <span className="sr-only">{t("Previous service")}</span>
          </button>
          <span
            aria-hidden="true"
            data-slide-counter
            className="inline-flex min-w-[5.5rem] shrink-0 items-center justify-center text-sm font-semibold tracking-[0.12em] whitespace-nowrap text-brass-ink tabular-nums"
          >
            {String(active + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            onPointerEnter={hoverOn}
            onPointerLeave={hoverOff}
            className="inline-flex size-11 items-center justify-center rounded-full border border-forest/30 text-forest transition-colors hover:border-brass hover:bg-white"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
            <span className="sr-only">{t("Next service")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
