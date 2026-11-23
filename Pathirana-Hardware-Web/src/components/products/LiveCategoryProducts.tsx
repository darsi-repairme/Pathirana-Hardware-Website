"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CloudOff } from "lucide-react";
import { fetchProducts, type LivePage } from "@/lib/catalogue";
import { Container } from "@/components/ui/Container";
import { LiveProductCard } from "./LiveProductParts";
import { useT } from "@/i18n/I18nProvider";

/**
 * Published products of one category, loaded from the API in the browser
 * (no rebuild needed). Renders nothing while the category has none online.
 */
export function LiveCategoryProducts({ category, title }: { category: string; title: string }) {
  const [result, setResult] = useState<{ data?: LivePage; error?: true } | null>(null);
  const [retry, setRetry] = useState(0);
  const t = useT();

  useEffect(() => {
    const ctrl = new AbortController();
    fetchProducts({ category, page: 1 }, ctrl.signal)
      .then((data) => setResult({ data }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ error: true });
      });
    return () => ctrl.abort();
  }, [category, retry]);

  const data = result?.data;
  if (data && data.total === 0) return null;

  return (
    <section
      aria-labelledby="live-category-products"
      data-catalogue="category"
      data-catalogue-state={!result ? "loading" : result.error ? "error" : "ready"}
      className="bg-cream pb-16 lg:pb-24"
    >
      <Container size="wide">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="live-category-products" className="font-display text-2xl font-medium text-charcoal sm:text-3xl">
            {t("{name} — product list", { name: t(title) })}
          </h2>
          {data && data.total > data.items.length ? (
            <Link
              href={`/products/?category=${encodeURIComponent(category)}#all-products`}
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-forest hover:text-brass-ink"
            >
              {t("View all {n}", { n: data.total })} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
        {result?.error ? (
          <p
            role="alert"
            className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line/70 bg-white p-5 text-ink-muted"
          >
            <CloudOff aria-hidden="true" className="size-5 text-brass-ink" />
            {t("The online product list is temporarily unavailable.")}
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="font-semibold text-forest underline underline-offset-4"
            >
              {t("Try again")}
            </button>
          </p>
        ) : data ? (
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((p) => (
              <li key={p.slug}>
                <LiveProductCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <div
            aria-hidden="true"
            className="mt-6 h-40 rounded-2xl border border-line/70 bg-white/70 motion-safe:animate-pulse"
          />
        )}
      </Container>
    </section>
  );
}
