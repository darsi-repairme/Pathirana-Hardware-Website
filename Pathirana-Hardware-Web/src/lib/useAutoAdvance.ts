"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type Options = {
  /** Milliseconds between automatic steps. */
  delay: number;
  /** Called to advance one step. */
  onAdvance: () => void;
  /** Changes on every slide change (manual or automatic) — restarts the full delay. */
  step: unknown;
  /** Extra external pause (e.g. while dragging). */
  hold?: boolean;
};

/**
 * Gentle automatic advance for a carousel-like region (hero, services ring).
 * Runs only while ALL of these hold:
 *  • the visitor has not asked for reduced motion,
 *  • the tab is visible and the region is on screen,
 *  • the pointer is not resting on it (hover-capable devices),
 *  • keyboard focus (:focus-visible) is not inside it,
 *  • no external hold (e.g. an active swipe).
 * One timer at a time; each step (manual or automatic) restarts the delay, so
 * manual navigation never triggers an immediate extra change. Returns whether
 * it is currently running (e.g. to quiet live-region announcements).
 */
export function useAutoAdvance(ref: RefObject<HTMLElement | null>, { delay, onAdvance, step, hold = false }: Options) {
  const [flags, setFlags] = useState({ reduce: true, hidden: false, offscreen: true, hover: false, focus: false });
  const advance = useRef(onAdvance);
  useEffect(() => {
    advance.current = onAdvance;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (patch: Partial<typeof flags>) => setFlags((f) => ({ ...f, ...patch }));

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onReduce = () => set({ reduce: reduce.matches });
    const onVisibility = () => set({ hidden: document.hidden });
    const onEnter = () => canHover.matches && set({ hover: true });
    const onLeave = () => set({ hover: false });
    const onFocusIn = (e: FocusEvent) => {
      if ((e.target as HTMLElement).matches?.(":focus-visible")) set({ focus: true });
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) set({ focus: false });
    };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => set({ offscreen: !entry?.isIntersecting }), { threshold: 0.35 });

    set({ reduce: reduce.matches, hidden: document.hidden, offscreen: !io });
    io?.observe(el);
    reduce.addEventListener("change", onReduce);
    document.addEventListener("visibilitychange", onVisibility);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      io?.disconnect();
      reduce.removeEventListener("change", onReduce);
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [ref]);

  const running = !flags.reduce && !flags.hidden && !flags.offscreen && !flags.hover && !flags.focus && !hold;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => advance.current(), delay);
    return () => window.clearTimeout(id);
  }, [running, delay, step]);

  return running;
}
