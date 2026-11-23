"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Element to render. */
  as?: "div" | "section";
  /**
   * Decorative-only: share of the element that must be visible before it
   * animates in. Leave unset for anything containing content — content then
   * reveals as soon as it enters the viewport, so it can never sit on screen
   * in its hidden start state.
   */
  threshold?: number;
};

/**
 * Replayable scroll reveal (progressive enhancement).
 *
 * The static HTML is fully visible. After hydration — unless the visitor
 * prefers reduced motion — the element toggles `data-inview`:
 *   "in"      → visible; CSS plays the reveal.
 *   "pending" → reset to the start state, ready to replay.
 *
 * Hysteresis prevents flicker at section edges: an element animates IN as soon
 * as any part of it enters the viewport (decorative elements may ask for a
 * larger visible share via `threshold`), and only RESETS after it has left the
 * viewport completely. So scrolling down plays reveals, scrolling back up and
 * down again replays them, and nothing hides while any part of it is on screen.
 *
 * (Previously content waited for 30% of the element — or a quarter of the
 * viewport — to be visible. Tall groups on phones, e.g. the six-service grid,
 * could rest partly on screen below both limits, leaving visible text at
 * opacity 0 until the visitor scrolled further.)
 */
export function InView({ children, className = "", as: Tag = "div", threshold = 0 }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches || typeof IntersectionObserver === "undefined") return;

    // Already on screen at load: leave it visible (no flash); it will reset
    // once scrolled fully away and replay on return.
    const r = el.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < window.innerHeight;
    el.dataset.inview = onScreen ? "in" : "pending";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            el.dataset.inview = "pending";
          } else if (
            threshold === 0 ||
            entry.intersectionRatio >= threshold ||
            entry.intersectionRect.height >= window.innerHeight * 0.25
          ) {
            el.dataset.inview = "in";
          }
        }
      },
      // 0 fires on entry/exit; the others only matter for a decorative threshold.
      { threshold: threshold === 0 ? [0] : [0, 0.15, threshold, 0.5] },
    );
    observer.observe(el);
    const onChange = () => {
      if (reduce.matches) {
        observer.disconnect();
        delete el.dataset.inview;
      }
    };
    reduce.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      reduce.removeEventListener("change", onChange);
    };
  }, [threshold]);

  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
