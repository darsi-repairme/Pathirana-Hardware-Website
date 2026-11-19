"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  PackageSearch,
  Phone,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { business, telHref, whatsappEnquiryHref } from "@/content/business";
import {
  fetchBrands,
  fetchCategories,
  fetchProducts,
  PAGE_SIZE,
  type LiveBrand,
  type LiveCategory,
  type LivePage,
} from "@/lib/catalogue";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { LiveProductCard } from "./LiveProductParts";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugOrEmpty = (v: string | null) => (v && SLUG.test(v) ? v : "");

const control =
  "h-12 w-full rounded-full border border-line-strong bg-white text-[0.95rem] text-charcoal transition-[border-color,box-shadow] duration-300 outline-none hover:border-brass focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.2)]";

/** Reads ?q=, ?category= and ?brand= (e.g. from the header search) and renders the live catalogue. */
export function LiveCatalogue() {
  const params = useSearchParams();
  return (
    <LiveCatalogueView
      urlQuery={params.get("q") ?? ""}
      urlCategory={slugOrEmpty(params.get("category"))}
      urlBrand={slugOrEmpty(params.get("brand"))}
    />
  );
}

type Result = { key: string; data?: LivePage; error?: true };

/**
 * Search · category · brand · reset, then the PUBLISHED products from the API,
 * paginated. Newly published products appear without rebuilding the site.
 * If the API cannot be reached, an honest "temporarily unavailable" state is
 * shown — never substitute or invented products.
 */
export function LiveCatalogueView({
  urlQuery,
  urlCategory,
  urlBrand,
}: {
  urlQuery: string;
  urlCategory: string;
  urlBrand: string;
}) {
  const id = useId();
  const [query, setQuery] = useState(urlQuery);
  const [debounced, setDebounced] = useState(urlQuery.trim());
  const [category, setCategory] = useState(urlCategory);
  const [brand, setBrand] = useState(urlBrand);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<LiveCategory[]>([]);
  const [brands, setBrands] = useState<LiveBrand[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);

  // A new header search while on this page updates the URL → adopt it.
  const [seen, setSeen] = useState({ urlQuery, urlCategory, urlBrand });
  if (seen.urlQuery !== urlQuery || seen.urlCategory !== urlCategory || seen.urlBrand !== urlBrand) {
    setSeen({ urlQuery, urlCategory, urlBrand });
    setQuery(urlQuery);
    setDebounced(urlQuery.trim());
    setCategory(urlCategory);
    setBrand(urlBrand);
    setPage(1);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim() !== debounced) {
        setDebounced(query.trim());
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, debounced]);

  // Filter options (published data only); failures leave the lists empty.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchCategories(ctrl.signal)
      .then(setCategories)
      .catch(() => {});
    fetchBrands(ctrl.signal)
      .then(setBrands)
      .catch(() => {});
    return () => ctrl.abort();
  }, [retry]);

  const key = JSON.stringify({ q: debounced, category, brand, page, retry });
  useEffect(() => {
    const ctrl = new AbortController();
    fetchProducts({ q: debounced, category, brand, page }, ctrl.signal)
      .then((data) => setResult({ key, data }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, error: true });
      });
    return () => ctrl.abort();
  }, [key, debounced, category, brand, page]);

  // Keep the address shareable (?q=&category=&brand=) without adding history entries.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (debounced) sp.set("q", debounced);
    if (category) sp.set("category", category);
    if (brand) sp.set("brand", brand);
    const next = `${window.location.pathname}${sp.size ? `?${sp}` : ""}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [debounced, category, brand]);

  const current = result?.key === key ? result : null;
  const data = current?.data;
  const filtered = Boolean(debounced || category || brand);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const state = !current
    ? "loading"
    : current.error
      ? "error"
      : data!.total === 0
        ? filtered
          ? "no-match"
          : "empty"
        : "ready";
  const selectedCategory = categories.find((c) => c.slug === category);
  const selectedBrand = brands.find((b) => b.slug === brand);

  const reset = () => {
    setQuery("");
    setDebounced("");
    setCategory("");
    setBrand("");
    setPage(1);
  };
  const goTo = (n: number) => {
    setPage(n);
    document.getElementById("all-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div data-catalogue="live" data-catalogue-state={state}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]">
        <form
          role="search"
          aria-label="Products"
          action="/products/"
          method="get"
          onSubmit={(e) => {
            e.preventDefault();
            setDebounced(query.trim());
            setPage(1);
          }}
          className="relative col-span-2 lg:col-span-1"
        >
          <label htmlFor={`${id}-q`} className="sr-only">
            Search products by name
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
            placeholder="Search products"
            maxLength={80}
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
              <span className="sr-only">Clear search text</span>
            </button>
          ) : null}
        </form>

        <div className="relative min-w-0">
          <label htmlFor={`${id}-cat`} className="sr-only">
            Filter by category
          </label>
          <select
            id={`${id}-cat`}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className={`${control} appearance-none truncate pr-10 pl-4`}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
            {category && !selectedCategory ? <option value={category}>{category}</option> : null}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-forest"
          />
        </div>

        <div className="relative min-w-0">
          <label htmlFor={`${id}-brand`} className="sr-only">
            Filter by brand
          </label>
          <select
            id={`${id}-brand`}
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setPage(1);
            }}
            className={`${control} appearance-none truncate pr-10 pl-4`}
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
            {brand && !selectedBrand ? <option value={brand}>{brand}</option> : null}
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
          <RotateCcw aria-hidden="true" className="size-4" /> Reset Filters
        </button>
      </div>

      <p aria-live="polite" className="mt-4 min-h-5 text-sm text-ink-muted">
        {data ? (
          <>
            {data.total === 1 ? "1 product" : `${data.total} products`}
            {selectedCategory ? (
              <>
                {" "}
                in <strong className="text-charcoal">{selectedCategory.name}</strong>
              </>
            ) : null}
            {selectedBrand ? (
              <>
                {" "}
                from <strong className="text-charcoal">{selectedBrand.name}</strong>
              </>
            ) : null}
            {debounced ? (
              <>
                {" "}
                matching <strong className="text-charcoal">“{debounced}”</strong>
              </>
            ) : null}
          </>
        ) : state === "loading" ? (
          "Loading products…"
        ) : null}
      </p>

      {state === "loading" ? (
        <ul aria-hidden="true" className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-96 rounded-2xl border border-line/70 bg-white/70 motion-safe:animate-pulse" />
          ))}
        </ul>
      ) : null}

      {state === "ready" && data ? (
        <>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((p) => (
              <li key={p.slug}>
                <LiveProductCard product={p} />
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label="Product pages" className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goTo(page - 1)}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-forest/25 px-4 font-semibold text-forest hover:border-brass hover:bg-white disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="size-4" /> Previous
              </button>
              <span className="text-sm text-ink-muted">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => goTo(page + 1)}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-forest/25 px-4 font-semibold text-forest hover:border-brass hover:bg-white disabled:opacity-40"
              >
                Next <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </nav>
          ) : null}
        </>
      ) : null}

      {state === "error" || state === "empty" || state === "no-match" ? (
        <div
          role={state === "error" ? "alert" : undefined}
          className="mt-6 rounded-2xl border border-line/70 bg-white p-8 text-center sm:p-12"
        >
          {state === "error" ? (
            <CloudOff aria-hidden="true" className="mx-auto size-9 text-brass-ink" />
          ) : state === "empty" ? (
            <PackageSearch aria-hidden="true" className="mx-auto size-9 text-brass-ink" />
          ) : (
            <SearchX aria-hidden="true" className="mx-auto size-9 text-brass-ink" />
          )}
          <h3 className="mt-4 font-display text-2xl text-forest">
            {state === "error"
              ? "Product list temporarily unavailable"
              : state === "empty"
                ? "Products are being added"
                : "No matching products"}
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-ink-muted">
            {state === "error"
              ? "We could not load the product list right now. Please try again in a moment, or call or WhatsApp the store — we are happy to help."
              : state === "empty"
                ? "Our online product list is being prepared. Browse the categories above, or call or WhatsApp the store to ask about what you need."
                : "Nothing matches these filters. The store may still have what you need — call or WhatsApp to ask."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold">
            <a
              href={whatsappEnquiryHref(debounced || selectedCategory?.name || "your products")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-forest hover:text-brass-ink"
            >
              <WhatsAppIcon className="size-4" /> Ask on WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a href={telHref} className="inline-flex min-h-11 items-center gap-2 text-forest hover:text-brass-ink">
              <Phone aria-hidden="true" className="size-4" /> Call {business.phone.display}
            </a>
            {state === "error" ? (
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="inline-flex min-h-11 items-center gap-2 text-forest underline underline-offset-4"
              >
                Try again
              </button>
            ) : state === "no-match" ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-11 items-center gap-2 text-forest underline underline-offset-4"
              >
                Show all products
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
