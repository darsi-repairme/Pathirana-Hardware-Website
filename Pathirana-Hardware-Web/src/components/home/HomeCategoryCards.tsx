"use client";

import Link from "next/link";
import { useCategories } from "@/lib/live-taxonomy";
import { CategoryVisual, CategoryIcon } from "@/components/products/CategoryVisual";
import { TaxonomyNotice } from "@/components/products/TaxonomyStates";
import { useCategoryText } from "@/i18n/I18nProvider";

const delays = ["d2", "d3", "d4", "d5", "d6"];

/**
 * Home › product category cards: the ACTIVE categories staff manage (live database
 * only, no rebuild).
 */
export function HomeCategoryCards() {
  const { items, status, retry } = useCategories();
  const text = useCategoryText();
  if (status === "empty" || status === "error") {
    return (
      <div data-taxonomy-status={status} className="mt-10">
        <TaxonomyNotice status={status} kind="categories" onRetry={retry} />
      </div>
    );
  }
  if (status === "loading") {
    return (
      <ul data-taxonomy-status="loading" aria-busy="true" className="mt-10 flex flex-wrap justify-center gap-5">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            aria-hidden="true"
            className="h-56 w-full rounded-[var(--radius-card)] bg-forest/10 motion-safe:animate-pulse min-[520px]:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]"
          />
        ))}
      </ul>
    );
  }
  return (
    <ul data-taxonomy-status={status} className="mt-10 flex flex-wrap justify-center gap-5">
      {items.map((c, i) => {
        return (
          <li
            key={c.slug}
            className={`rv ${delays[Math.min(i, delays.length - 1)]} w-full min-[520px]:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]`}
          >
            <Link
              href={c.href}
              className="zoom-img group grid h-full grid-cols-[7.5rem_1fr] overflow-hidden rounded-[var(--radius-card)] bg-forest shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none min-[520px]:flex min-[520px]:flex-col"
            >
              <div className="relative min-h-28 overflow-hidden min-[520px]:aspect-[4/3] min-[520px]:min-h-0">
                <CategoryVisual
                  category={c}
                  sizes="(min-width: 1440px) 340px, (min-width: 1024px) 24vw, (min-width: 520px) 50vw, 120px"
                />
              </div>
              <div className="flex-1 border-l-2 border-brass px-4 py-3 min-[520px]:border-t-2 min-[520px]:border-l-0 min-[520px]:px-5 min-[520px]:py-4">
                <h3 className="flex items-center gap-3 text-base font-semibold text-white">
                  <CategoryIcon slug={c.slug} strokeWidth={1.6} className="size-5 shrink-0 text-gold-soft" />
                  <span className="link-underline min-w-0">{text(c).title}</span>
                </h3>
                {c.summary ? <p className="mt-1.5 text-sm leading-relaxed text-sage">{text(c).summary}</p> : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
