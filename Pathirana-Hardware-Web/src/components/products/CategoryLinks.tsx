"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCategories } from "@/lib/live-taxonomy";
import { CategoryIcon } from "./CategoryVisual";
import { TaxonomyNotice } from "./TaxonomyStates";
import { useCategoryText, useT } from "@/i18n/I18nProvider";

/** About › Our Product Categories: one row per ACTIVE category (live when available). */
export function CategoryRowList({ className = "" }: { className?: string }) {
  const { items, status, retry } = useCategories();
  const text = useCategoryText();
  if (status === "empty" || status === "error") {
    return (
      <div data-taxonomy-status={status} className={className}>
        <TaxonomyNotice status={status} kind="categories" onRetry={retry} compact />
      </div>
    );
  }
  return (
    <ul data-taxonomy-status={status} aria-busy={status === "loading" || undefined} className={className}>
      {items.map((c) => {
        return (
          <li key={c.slug}>
            <Link
              href={c.href}
              className="group flex min-h-14 items-center gap-4 border-b border-line py-3.5 transition-colors duration-200 hover:text-forest"
            >
              <CategoryIcon slug={c.slug} strokeWidth={1.5} className="size-5 shrink-0 text-brass" />
              <span className="min-w-0 flex-1 font-display text-lg font-medium text-charcoal group-hover:text-forest">
                {text(c).title}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-4 shrink-0 text-forest transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Category pages › Other categories: pill links to every other ACTIVE category. */
export function OtherCategoryPills({ current, className = "" }: { current: string; className?: string }) {
  const { items, status, retry } = useCategories();
  const text = useCategoryText();
  const t = useT();
  const others = items.filter((c) => c.slug !== current);
  if (status === "error" || ((status === "live" || status === "empty") && others.length === 0)) {
    return (
      <div data-taxonomy-status={status} className={className}>
        {status === "error" ? (
          <TaxonomyNotice status="error" kind="categories" onRetry={retry} compact />
        ) : (
          <p className="text-sm text-ink-muted">{t("No other categories are listed online yet.")}</p>
        )}
      </div>
    );
  }
  return (
    <ul data-taxonomy-status={status} aria-busy={status === "loading" || undefined} className={className}>
      {others.map((c) => {
        return (
          <li key={c.slug}>
            <Link
              href={c.href}
              className="group inline-flex min-h-12 items-center gap-2.5 rounded-full border border-line-strong bg-white px-5 font-semibold text-forest transition-colors duration-200 hover:border-brass hover:bg-cream-deep"
            >
              <CategoryIcon slug={c.slug} strokeWidth={1.6} className="size-4 text-brass-ink" />
              {text(c).title}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
