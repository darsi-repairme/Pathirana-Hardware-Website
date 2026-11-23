"use client";

import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, LOCALE_META, LOCALE_QUERY_PARAM, LOCALE_STORAGE_KEY, type Locale } from "./config";
import { hasTranslation, translate, translator, type Translator, type Vars } from "./translate";
import { productEnquiryHref, type ProductEnquiry } from "@/lib/product-enquiry";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: Translator };
const I18nContext = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: translator(DEFAULT_LOCALE),
});

// Runs before paint in the browser; on the server (static build) it is a no-op.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The language chosen earlier (URL ?lang= first, then the remembered choice), else English. */
function initialLocale(): Locale {
  try {
    const q = new URLSearchParams(window.location.search).get(LOCALE_QUERY_PARAM);
    if (isLocale(q)) return q;
  } catch {}
  try {
    const s = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(s)) return s;
  } catch {}
  return DEFAULT_LOCALE;
}

/**
 * Client-side language state for the static site. The HTML is rendered in
 * English (the default); a remembered Tamil / Sinhala choice is applied before
 * the first paint after hydration, and switching later re-renders in place —
 * the URL, scroll position, product and form state are all kept.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const pathname = usePathname();

  useIsoLayoutEffect(() => {
    const l = initialLocale();
    if (l !== DEFAULT_LOCALE) setLocaleState(l);
  }, []);

  // <html lang> (screen readers, fonts, hyphenation) + reveal the page once the text matches.
  useIsoLayoutEffect(() => {
    const d = document.documentElement;
    d.lang = LOCALE_META[locale].htmlLang;
    d.setAttribute("data-locale", locale);
    d.classList.remove("i18n-pending");
  }, [locale]);

  // Other tabs: follow a change made elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCALE_STORAGE_KEY && isLocale(e.newValue)) setLocaleState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Image descriptions from the site's own image list (src/lib/images.ts) are swapped in place; the
  // English original is kept in data-alt-en. Staff-entered alt texts have no entry and stay as written.
  useEffect(() => {
    const apply = (root: ParentNode) => {
      root.querySelectorAll<HTMLImageElement>("img[alt]").forEach((img) => {
        const en = img.dataset.altEn ?? img.alt;
        if (!en || !hasTranslation(en)) return;
        img.dataset.altEn = en;
        const next = translate(locale, en);
        if (img.alt !== next) img.alt = next;
      });
    };
    apply(document);
    const mo = new MutationObserver((records) => {
      for (const rec of records) rec.addedNodes.forEach((n) => n instanceof Element && apply(n));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [locale]);

  // Browser tab title: Next.js sets the English title per page; translate its parts.
  useEffect(() => {
    const el = document.querySelector("title");
    if (!el) return;
    const apply = () => {
      const current = document.title;
      const source = el.dataset.en && el.dataset.translated === current ? el.dataset.en : current;
      el.dataset.en = source;
      const next =
        locale === "en"
          ? source
          : source
              .split(" | ")
              .map((p) => translate(locale, p))
              .join(" | ");
      el.dataset.translated = next;
      if (current !== next) document.title = next;
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [locale, pathname]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, l);
    } catch {}
    // Drop a ?lang= from the address so the remembered choice wins on later visits.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has(LOCALE_QUERY_PARAM)) {
        url.searchParams.delete(LOCALE_QUERY_PARAM);
        window.history.replaceState(window.history.state, "", url);
      }
    } catch {}
  }, []);

  const value = useMemo(() => ({ locale, setLocale, t: translator(locale) }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useLocale = () => useContext(I18nContext);
/** `const t = useT(); t("English text", { vars })` */
export const useT = () => useContext(I18nContext).t;

/**
 * Translated text for server components: `<T>Our Services</T>`,
 * `<T vars={{ n: 3 }}>{"{n} products"}</T>`. Children must be one string.
 */
export function T({ children, vars }: { children: string; vars?: Vars }) {
  const { t } = useContext(I18nContext);
  return <>{t(children, translateVars(t, vars))}</>;
}

/** Placeholder values that are the site's own English words (e.g. a category name) are translated too. */
export const translateVars = (t: Translator, vars?: Vars): Vars | undefined =>
  vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "string" ? t(v) : v]));

/** A landmark with a translated accessible name, for server components: `<TRegion as="nav" label="Main">`. */
export function TRegion({
  as: Tag = "nav",
  label,
  children,
  className,
}: {
  as?: "nav" | "aside" | "section" | "div" | "ul";
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useContext(I18nContext);
  return (
    <Tag aria-label={t(label)} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Dynamic (API) text: the staff-entered translation for the current language,
 * else the site's own translation of the same English text, else the English.
 * `pick(english, translations, "name")`
 */
export function useDynamicText() {
  const { locale, t } = useContext(I18nContext);
  return useCallback(
    <E extends string | null>(
      english: E,
      translations: Partial<Record<"ta" | "si", Partial<Record<string, unknown>>>> | null | undefined,
      field: string,
    ): E => {
      if (english === null) return english;
      const v = locale === "en" ? undefined : translations?.[locale]?.[field];
      return (typeof v === "string" && v.trim() ? v : t(english)) as E;
    },
    [locale, t],
  );
}

/** Product WhatsApp enquiry in the visitor's language (see lib/product-enquiry.ts). */
export function useEnquiryHref() {
  const { locale } = useContext(I18nContext);
  return useCallback((p: Omit<ProductEnquiry, "locale">) => productEnquiryHref({ ...p, locale }), [locale]);
}

/** Display category (see lib/taxonomy.ts) in the current language. */
export function useCategoryText() {
  const pick = useDynamicText();
  return useCallback(
    (c: {
      title: string;
      summary?: string;
      translations?: Partial<Record<"ta" | "si", Partial<Record<string, unknown>>>>;
    }) => ({
      title: pick(c.title, c.translations, "name"),
      summary: c.summary === undefined ? "" : pick(c.summary, c.translations, "summary"),
    }),
    [pick],
  );
}

/**
 * A translated sentence with embedded elements: `<TRich nodes={{ phone: <a…/> }}>{"Call {phone} today."}</TRich>`.
 * Placeholders keep their position in each language's word order. String values go in `vars`.
 */
export function TRich({ children, nodes, vars }: { children: string; nodes: Record<string, ReactNode>; vars?: Vars }) {
  const { t } = useContext(I18nContext);
  const text = t(children, translateVars(t, vars));
  const parts = text.split(/\{(\w+)\}/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <Fragment key={i}>{nodes[p] ?? `{${p}}`}</Fragment> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}
