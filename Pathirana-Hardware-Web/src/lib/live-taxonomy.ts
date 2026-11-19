"use client";

import { useEffect, useState } from "react";
import { fetchBrands, fetchCategories, liveCatalogueEnabled, type LiveBrand, type LiveCategory } from "./catalogue";
import { DOCUMENTED_BRANDS, DOCUMENTED_CATEGORIES, toDisplayBrand, toDisplayCategory } from "./taxonomy";

/** Browser hooks for the live category / brand lists (see ./taxonomy for the rules). */
/**
 * Shared request per list: every section on a page (and pages visited in the next
 * minute without a reload) reuse one response; after that a fresh one is made, so
 * staff changes reach visitors who keep browsing.
 */
const MAX_AGE_MS = 60_000;
function cached<T>(fetcher: () => Promise<T>) {
  let entry: { at: number; promise: Promise<T> } | null = null;
  return () => {
    if (!entry || Date.now() - entry.at > MAX_AGE_MS) {
      const promise = fetcher().catch((e: unknown) => {
        entry = null; // a failed request is retried next time
        throw e;
      });
      entry = { at: Date.now(), promise };
    }
    return entry.promise;
  };
}
const loadCategories = cached<LiveCategory[]>(() => fetchCategories());
const loadBrands = cached<LiveBrand[]>(() => fetchBrands());

/**
 * - "static": site built WITHOUT the API → the documented lists (nothing to load)
 * - "loading": request in flight → no items yet (sections show placeholders)
 * - "live": the API's ACTIVE entries (non-empty)
 * - "empty": the API answered with no active entries → honest "being added" state
 * - "error": API unreachable → honest "temporarily unavailable" state (with retry)
 * With the API, the documented lists are NEVER substituted: deactivated entries can
 * not reappear through static data.
 */
export type LiveStatus = "static" | "loading" | "live" | "empty" | "error";

function useLive<L, D>(load: () => Promise<L[]>, map: (l: L) => D, documented: readonly D[], enabled = true) {
  const live = liveCatalogueEnabled();
  const [state, setState] = useState<{ items: readonly D[]; status: LiveStatus }>(() =>
    live ? { items: [], status: "loading" } : { items: documented, status: "static" },
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!live || !enabled) return;
    let active = true;
    load()
      .then((items) => {
        if (active) setState({ items: items.map(map), status: items.length ? "live" : "empty" });
      })
      .catch(() => {
        if (active) setState({ items: [], status: "error" });
      });
    return () => {
      active = false;
    };
  }, [live, load, map, enabled, attempt]);
  const retry = () => {
    setState({ items: [], status: "loading" });
    setAttempt((n) => n + 1);
  };
  return { ...state, retry };
}

/** Active categories (live when available). `enabled: false` defers the request (e.g. until a search box is used). */
export const useCategories = (enabled = true) =>
  useLive(loadCategories, toDisplayCategory, DOCUMENTED_CATEGORIES, enabled);

/** Active brands (live when available). */
export const useBrands = (enabled = true) => useLive(loadBrands, toDisplayBrand, DOCUMENTED_BRANDS, enabled);

/** One category by slug from the live list ("found" only while ACTIVE). Used by the live category
 *  page and to gate the static category / product-type pages. */
export function useLiveCategory(slug: string) {
  const [state, setState] = useState<{ status: "loading" | "found" | "missing" | "error"; category?: LiveCategory }>({
    status: "loading",
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    loadCategories()
      .then((items) => {
        if (!active) return;
        const category = items.find((c) => c.slug === slug);
        setState(category ? { status: "found", category } : { status: "missing" });
      })
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [slug, retry]);
  return { ...state, retry: () => (setState({ status: "loading" }), setRetry((n) => n + 1)) };
}
