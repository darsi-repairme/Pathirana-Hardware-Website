import type { ReactNode } from "react";

/** Centred eyebrow with gold rules on both sides; the rules draw in (`.rv-line`). */
export function HomeEyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  const text = tone === "dark" ? "text-white/90" : "text-charcoal/80";
  return (
    <p className={`flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.32em] uppercase ${text}`}>
      <span aria-hidden="true" className="rv-line h-px w-10 bg-gold-soft sm:w-14" />
      {children}
      <span aria-hidden="true" className="rv-line h-px w-10 bg-gold-soft sm:w-14" />
    </p>
  );
}
