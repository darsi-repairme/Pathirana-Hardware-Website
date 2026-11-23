"use client";

import { useId, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { business } from "@/content/business";
import { useT } from "@/i18n/I18nProvider";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** The confirmed hours (e.g. "Monday – Saturday", "Sunday") expanded to one row per day. */
function weekly(entries: NonNullable<typeof business.openingHours>) {
  const hours = new Map<string, string>();
  for (const e of entries) {
    const [from, to] = e.days.split(/\s*[–-]\s*/);
    const a = DAYS.indexOf(from as (typeof DAYS)[number]);
    const b = to ? DAYS.indexOf(to as (typeof DAYS)[number]) : a;
    if (a < 0 || b < 0) continue;
    for (let i = a; i <= b; i++) hours.set(DAYS[i]!, e.hours);
  }
  return DAYS.filter((d) => hours.has(d)).map((d) => ({ day: d, hours: hours.get(d)! }));
}

/**
 * Opening Hours (Contact page): an accordion. Collapsed it shows the title and a short static
 * summary; expanded, every day of the week and the public-holiday note. The hours are the
 * client-confirmed ones from content/business.ts. Deliberately no live "Open now" status.
 */
export function OpeningHours({ className = "" }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!business.openingHours) return null;
  const rows = weekly(business.openingHours);
  return (
    <section
      aria-labelledby={`${id}-title`}
      data-opening-hours
      data-open={open || undefined}
      className={`relative overflow-hidden rounded-[var(--radius-panel)] border border-line/70 bg-white shadow-[var(--shadow-card)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest via-brass to-gold-soft"
      />
      <h2 id={`${id}-title`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full items-center gap-3 px-5 pt-6 pb-5 text-left outline-none focus-visible:bg-cream/60 sm:px-7"
        >
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-forest text-gold-soft">
            <Clock aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-2xl font-semibold text-forest">{t("Opening Hours")}</span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              {business.openingHours.map((e, i) => (
                <span key={e.days} className="block sm:inline">
                  {i ? <span className="hidden sm:inline"> · </span> : null}
                  {t(e.days)}: <span className="whitespace-nowrap">{t(e.hours)}</span>
                </span>
              ))}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-brass/50 text-brass-ink transition-colors group-hover:border-brass group-hover:bg-cream"
          >
            <ChevronDown
              className={`size-5 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </h2>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-title`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <dl className="mx-5 divide-y divide-line/70 border-t border-line/70 sm:mx-7" data-opening-days>
            {rows.map((r) => (
              <div key={r.day} className="flex items-baseline justify-between gap-x-6 py-2.5">
                <dt className="font-semibold text-charcoal">{t(r.day)}</dt>
                <dd
                  className={`text-right font-semibold whitespace-nowrap tabular-nums ${
                    r.hours === "Closed" ? "text-logo-red" : "text-forest"
                  }`}
                >
                  {t(r.hours)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mx-5 mt-3 mb-6 rounded-xl bg-cream/80 px-4 py-3 text-sm text-ink-muted sm:mx-7">
            {t("Public holiday opening hours may differ.")}
          </p>
        </div>
      </div>
    </section>
  );
}
