"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Phone, RotateCcw, Search, SearchX, X } from "lucide-react";
import { business, telHref, whatsappEnquiryHref } from "@/content/business";
import { useEnquiryHref, useLocale, useT } from "@/i18n/I18nProvider";
import {
  documentedBrands,
  getCategory,
  productCategories,
  type Brand,
  type ProductCategoryId,
  type ProductType,
} from "@/content/products";
import { filterProductTypes, normalizeQuery, searchProducts } from "@/lib/product-search";
import { whatsappCta } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { ProductTypeVisual } from "./ProductVisual";

type Filter = ProductCategoryId | "all";
type BrandFilter = Brand | "all";

const isCategory = (v: string | null): v is ProductCategoryId => !!v && productCategories.some((c) => c.id === v);

/** Reads ?q= and ?category= (e.g. from the header search) and renders the catalogue. */
export function ProductCatalogue() {
  const params = useSearchParams();
  const category = params.get("category");
  return <CatalogueView urlQuery={params.get("q") ?? ""} urlCategory={isCategory(category) ? category : "all"} />;
}

const control =
  "h-12 w-full rounded-full border border-line-strong bg-white text-[0.95rem] text-charcoal transition-[border-color,box-shadow] duration-300 outline-none hover:border-brass focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.2)]";

/**
 * Search · All Categories · All Brands · Reset, then the documented product
 * types. Filtering runs in the browser on the real product data only; the
 * three filters combine. Brands are matched only against brands documented on
 * a product type (none are yet) — never inferred — so a brand filter shows an
 * honest "ask the store" state instead of invented results.
 */
export function CatalogueView({ urlQuery, urlCategory }: { urlQuery: string; urlCategory: Filter }) {
  const id = useId();
  const [query, setQuery] = useState(urlQuery);
  const [category, setCategory] = useState<Filter>(urlCategory);
  const [brand, setBrand] = useState<BrandFilter>("all");
  const { t, locale } = useLocale();

  // A new header search while on this page updates the URL → adopt it.
  const [seen, setSeen] = useState({ urlQuery, urlCategory });
  if (seen.urlQuery !== urlQuery || seen.urlCategory !== urlCategory) {
    setSeen({ urlQuery, urlCategory });
    setQuery(urlQuery);
    setCategory(urlCategory);
  }

  const q = normalizeQuery(query);
  const results = filterProductTypes(query, category).filter((p) => brand === "all" || !!p.brands?.includes(brand));
  const selected = category === "all" ? null : getCategory(category);
  // Categories matching the words typed (helps when no product type matches, e.g. a brand name).
  const relatedCategories = q
    ? searchProducts(q).categories.filter((c) => category === "all" || c.id === category)
    : [];

  const reset = () => {
    setQuery("");
    setCategory("all");
    setBrand("all");
  };

  return (
    <div>
      {/* Controls: phones — search, then the two selects side by side, then Reset;
          lg — one row. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]">
        <form
          role="search"
          aria-label={t("Products")}
          action="/products/"
          method="get"
          onSubmit={(e) => e.preventDefault()}
          className="relative col-span-2 lg:col-span-1"
        >
          <label htmlFor={`${id}-q`} className="sr-only">
            {t("Search products by name")}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brass-ink"
          />
          <input
            id={`${id}-q`}
            name="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t("Search products")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${control} pl-12 ${query ? "pr-12" : "pr-4"} placeholder:text-ink-muted [&::-webkit-search-cancel-button]:appearance-none`}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-1.5 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-cream-deep"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">{t("Clear search text")}</span>
            </button>
          ) : null}
        </form>

        <div className="relative min-w-0">
          <label htmlFor={`${id}-cat`} className="sr-only">
            {t("Filter by category")}
          </label>
          <select
            id={`${id}-cat`}
            value={category}
            onChange={(e) => setCategory(e.target.value as Filter)}
            className={`${control} appearance-none truncate pr-10 pl-4`}
          >
            <option value="all">{t("All Categories")}</option>
            {productCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.title)}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-forest"
          />
        </div>

        <div className="relative min-w-0">
          <label htmlFor={`${id}-brand`} className="sr-only">
            {t("Filter by brand")}
          </label>
          <select
            id={`${id}-brand`}
            value={brand}
            onChange={(e) => setBrand(e.target.value as BrandFilter)}
            className={`${control} appearance-none truncate pr-10 pl-4`}
          >
            <option value="all">{t("All Brands")}</option>
            {documentedBrands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-forest"
          />
        </div>

        <button
          type="button"
          onClick={reset}
          className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-forest/25 px-5 text-[0.95rem] font-semibold text-forest transition-colors hover:border-brass hover:bg-cream lg:col-span-1"
        >
          <RotateCcw aria-hidden="true" className="size-4" /> {t("Reset Filters")}
        </button>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-ink-muted">
        {results.length === 1 ? t("1 product") : t("{n} products", { n: results.length })}
        {selected ? (
          <>
            {" · "}
            {t("Category:")} <strong className="text-charcoal">{t(selected.title)}</strong>
          </>
        ) : null}
        {brand !== "all" ? (
          <>
            {" · "}
            {t("Brand:")} <strong className="text-charcoal">{brand}</strong>
          </>
        ) : null}
        {q ? (
          <>
            {" · "}
            {t("Search:")} <strong className="text-charcoal">“{q}”</strong>
          </>
        ) : null}
      </p>

      {/* Results */}
      {results.length > 0 ? (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((p) => (
            <li key={p.slug}>
              <ProductListingCard product={p} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl border border-line/70 bg-white p-8 text-center sm:p-12">
          <SearchX aria-hidden="true" className="mx-auto size-9 text-brass-ink" />
          <h3 className="mt-4 font-display text-2xl text-forest">{t("No matching products")}</h3>
          <p className="mx-auto mt-3 max-w-lg text-ink-muted">
            {brand !== "all"
              ? t(
                  "Individual {brand} products are not listed online yet. Branded hardware is available to enquire about — ask the store.",
                  { brand },
                )
              : t(
                  "Only documented product types are listed online. The store may still have what you need — call or WhatsApp to ask.",
                )}
          </p>
          {brand !== "all" || relatedCategories.length > 0 || selected ? (
            <ul className="mt-6 flex flex-wrap justify-center gap-3">
              {(brand !== "all"
                ? [getCategory("branded-hardware")!]
                : relatedCategories.length > 0
                  ? relatedCategories
                  : selected
                    ? [selected]
                    : []
              ).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/products/categories/${c.id}/`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-forest/25 px-5 font-semibold text-forest hover:border-brass hover:bg-cream"
                  >
                    {t("View {name}", { name: t(c.title) })}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="contact-actions mt-6 text-sm" data-contact-actions>
            <a
              href={whatsappEnquiryHref(
                brand !== "all"
                  ? t("{brand} products", { brand })
                  : q || (selected ? t(selected.title) : "") || t("your products"),
                locale,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-action text-forest hover:text-brass-ink"
            >
              <WhatsAppIcon className="size-4" /> {t("Ask on WhatsApp")}
              <span className="sr-only"> {t("(opens in a new tab)")}</span>
            </a>
            <a href={telHref} className="contact-action text-forest hover:text-brass-ink">
              <Phone aria-hidden="true" className="size-4" /> {t("Call {phone}", { phone: business.phone.display })}
            </a>
            <button type="button" onClick={reset} className="contact-action text-forest underline underline-offset-4">
              {t("Show all products")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Listing card: image, name (opens the product page), one-line summary and an
 * equal-size "Enquire on WhatsApp" button. No prices, stock or cart.
 */
function ProductListingCard({ product }: { product: ProductType }) {
  const t = useT();
  const enquiryHref = useEnquiryHref();
  const name = t(product.name);
  return (
    <article className="zoom-img group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:border-brass/40 hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[16/10] overflow-hidden bg-forest-900 sm:aspect-[4/3]">
        <ProductTypeVisual
          product={product}
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 24vw, (min-width: 640px) 50vw, 100vw"
          decorative
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-semibold text-forest">
          {/* Stretched link: the card opens the product page. */}
          <Link
            href={`/products/${product.slug}/`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {name}
          </Link>
        </h3>
        <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">{t(product.summary)}</p>
        <div className="mt-auto pt-4">
          <a
            href={enquiryHref({ name, price: null, path: `/products/${product.slug}/` })}
            target="_blank"
            rel="noopener noreferrer"
            className={whatsappCta}
          >
            <WhatsAppIcon className="size-4" /> {t("Enquire on WhatsApp")}
            <span className="sr-only"> {t("about {name} (opens in a new tab)", { name })}</span>
          </a>
        </div>
      </div>
    </article>
  );
}
