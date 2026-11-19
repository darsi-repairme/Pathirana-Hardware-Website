import { ChevronDown, type LucideIcon } from "lucide-react";
import type { FaqItem } from "@/content/faq";

/**
 * Accessible accordion built on native <details>/<summary>: keyboard
 * (Enter/Space) and screen-reader support without JavaScript, and the answers
 * stay in the static HTML for search engines. Opening/closing animates where
 * the browser supports it (globals.css › .faq-item).
 *
 * variant "card" (default): rows inside a white card (FAQ page).
 * variant "rows": open rows split by hairlines, each with a small gold icon
 * (Contact page).
 */
export function FaqAccordion({
  items,
  headingLevel = "h3",
  variant = "card",
  icons,
}: {
  items: readonly FaqItem[];
  headingLevel?: "h2" | "h3";
  variant?: "card" | "rows";
  /** Icon per item id (rows variant). */
  icons?: Partial<Record<string, LucideIcon>>;
}) {
  const Heading = headingLevel;
  const rows = variant === "rows";
  return (
    <div
      className={
        rows
          ? "divide-y divide-line border-y border-line"
          : "divide-y divide-line/80 overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-white shadow-[var(--shadow-card)]"
      }
    >
      {items.map((item) => {
        const Icon = icons?.[item.id];
        return (
          <details key={item.id} id={item.id} className="faq-item group scroll-mt-32">
            <summary
              className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 transition-colors duration-200 [&::-webkit-details-marker]:hidden ${
                rows ? "px-1 hover:text-forest sm:px-2" : "px-5 hover:bg-cream/70 sm:px-7"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3.5">
                {Icon ? (
                  <span
                    aria-hidden="true"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass"
                  >
                    <Icon strokeWidth={1.6} className="size-[1.1rem]" />
                  </span>
                ) : null}
                <Heading className="text-[1.05rem] leading-snug font-semibold text-charcoal sm:text-lg">
                  {item.question}
                </Heading>
              </span>
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-forest transition-[transform,background-color,color] duration-300 group-open:rotate-180 group-open:border-forest group-open:bg-forest group-open:text-white motion-reduce:transition-none"
              >
                <ChevronDown className="size-4" />
              </span>
            </summary>
            <div
              className={
                rows ? `pb-6 ${Icon ? "pl-[3.4rem] sm:pl-[3.65rem]" : "px-1 sm:px-2"} pr-1` : "px-5 pb-6 sm:px-7"
              }
            >
              <p className="max-w-3xl border-l-2 border-brass pl-4 leading-relaxed text-ink-muted">{item.answer}</p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
