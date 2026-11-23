"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { productCategories } from "@/content/products";
import { productsSearchHref } from "@/lib/product-search";
import { useBrands, useCategories } from "@/lib/live-taxonomy";
import { useDynamicText, useT } from "@/i18n/I18nProvider";

type Props = {
  className?: string;
  autoFocus?: boolean;
  /** Called after navigating (e.g. to close the mobile search panel). */
  onSubmitted?: () => void;
  initialValue?: string;
  /** Visual tone: on the dark header, or on a light page. */
  tone?: "dark" | "light";
  /** Accessible name of the search landmark (must be unique per page). */
  label?: string;
};

/** Suggestions come only from verified data (see below). */
const documentedSuggestions = productCategories.flatMap((c) => [c.title, ...c.searchTerms.slice(0, 4)]);

/**
 * Product search. Works without JavaScript (a plain GET form to /products/);
 * with JavaScript it navigates client-side. Native <datalist> suggestions.
 */
export function HeaderSearch({
  className = "",
  autoFocus,
  onSubmitted,
  initialValue = "",
  tone = "dark",
  label = "Site",
}: Props) {
  const router = useRouter();
  const t = useT();
  const pick = useDynamicText();
  const [value, setValue] = useState(initialValue);
  const id = useId();
  const listId = `${id}-suggestions`;
  // Live names are only fetched once the search box is used (the header is on every page).
  const [used, setUsed] = useState(false);
  const categories = useCategories(used);
  const brands = useBrands(used);
  // Without the API: the documented category terms. With it: only ACTIVE names (never deactivated ones).
  const suggestions =
    categories.status === "static"
      ? Array.from(new Set(documentedSuggestions.map((s) => t(s))))
      : Array.from(
          new Set([
            ...categories.items.map((c) => pick(c.title, c.translations, "name")),
            ...brands.items.map((b) => b.name),
          ]),
        );

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(productsSearchHref(value));
    onSubmitted?.();
  };

  const dark = tone === "dark";
  return (
    <form
      role="search"
      aria-label={t(label)}
      action="/products/"
      method="get"
      onSubmit={submit}
      className={`relative ${className}`}
    >
      <label htmlFor={`${id}-q`} className="sr-only">
        {t("Search products")}
      </label>
      <Search
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 ${dark ? "text-gold-soft" : "text-brass-ink"}`}
      />
      <input
        id={`${id}-q`}
        name="q"
        type="search"
        list={listId}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={t("Search products...")}
        value={value}
        autoFocus={autoFocus}
        onFocus={() => setUsed(true)}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            setValue("");
          }
        }}
        className={`h-11 w-full rounded-full border pr-10 pl-10 text-sm transition-[border-color,background-color,box-shadow] duration-300 outline-none [&::-webkit-search-cancel-button]:appearance-none ${
          dark
            ? "border-white/20 bg-white/10 text-white placeholder:text-white/70 hover:border-gold-soft/60 focus:border-gold-soft focus:bg-white/15 focus:shadow-[0_0_0_3px_rgb(232_190_79/0.35)]"
            : "border-line-strong bg-white text-charcoal placeholder:text-ink-muted hover:border-brass focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.2)]"
        }`}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className={`absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full ${
            dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-muted hover:bg-cream-deep"
          }`}
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("Clear search")}</span>
        </button>
      ) : null}
    </form>
  );
}
