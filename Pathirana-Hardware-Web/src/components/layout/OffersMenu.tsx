"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Copy, FileText, Gift, Tag, X } from "lucide-react";
import { SiteLink } from "@/components/ui/SiteLink";
import { LOCALE_META } from "@/i18n/config";
import { useDynamicText, useLocale } from "@/i18n/I18nProvider";
import { formatLkr } from "@/lib/money";
import { productHref } from "@/lib/catalogue";
import { categoryHref } from "@/lib/taxonomy";
import { copyText, loadOffers, offersEnabled, quotationWithCodeHref, type Offer } from "@/lib/offers";

type State = { status: "idle" | "loading" | "ready" | "error"; items: Offer[] };

/**
 * Header › Offers: a circular gift button (brass-gold ring, small red "Offers" badge) that opens a
 * compact panel listing the offers staff have PUBLISHED in the Admin. Nothing is invented: with no
 * published offers (or no API) the panel says so. Loaded on first open only.
 *
 * Closes on outside click / tap, Escape (focus returns to the button) and Tab past the end;
 * ↑ ↓ move between the panel's controls. On phones the panel spans the screen width minus the
 * gutters, so it never overflows.
 */
export function OffersMenu() {
  const { t, locale } = useLocale();
  const pick = useDynamicText();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle", items: [] });
  const [copied, setCopied] = useState<string | null>(null);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!offersEnabled()) {
      setState({ status: "ready", items: [] });
      return;
    }
    setState((s) => ({ ...s, status: "loading" }));
    loadOffers()
      .then((items) => setState({ status: "ready", items }))
      .catch(() => setState({ status: "error", items: [] }));
  }, []);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const toggle = () => {
    if (!open && state.status !== "ready" && state.status !== "loading") load();
    setOpen((o) => !o);
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const focusables = [...(panel.current?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? [])];
    if (!focusables.length) return;
    e.preventDefault();
    const i = focusables.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % focusables.length : (i - 1 + focusables.length) % focusables.length;
    focusables[i === -1 ? 0 : next]?.focus();
  };

  const copy = async (code: string) => {
    if (await copyText(code)) {
      setCopied(code);
      window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 2500);
    }
  };

  const date = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(LOCALE_META[locale].htmlLang, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(`${iso}T00:00:00Z`),
      );
    } catch {
      return iso;
    }
  };
  const discount = (o: Offer) =>
    o.discountType === "percentage" && o.discountValue
      ? t("{value}% off", { value: String(o.discountValue) })
      : o.discountType === "fixed" && o.discountValue
        ? t("{amount} off", { amount: formatLkr(o.discountValue.toFixed(2)) })
        : null;

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        data-offers-button
        className="header-action header-offers"
      >
        <Gift aria-hidden="true" />
        <span aria-hidden="true" className="header-offers-badge">
          {t("Offers")}
        </span>
        <span className="sr-only">{t("Special offers and promo codes")}</span>
      </button>

      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-label={t("Special offers and promo codes")}
        tabIndex={-1}
        hidden={!open}
        onKeyDown={onPanelKey}
        data-offers-panel
        className="offers-panel fixed inset-x-4 top-[calc(var(--header-h)+0.5rem)] z-50 max-h-[calc(100dvh-var(--header-h)-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-gold-soft/40 bg-paper text-charcoal shadow-[var(--shadow-lift)] outline-none sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-3 sm:w-[23rem]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
            <Gift aria-hidden="true" className="size-5 text-brass" />
            {t("Special offers")}
          </p>
          <button
            type="button"
            onClick={() => close()}
            className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-cream hover:text-forest"
          >
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("Close offers")}</span>
          </button>
        </div>

        <div className="p-3" aria-live="polite">
          {state.status === "loading" || state.status === "idle" ? (
            <p className="px-2 py-6 text-center text-sm text-ink-muted" role="status">
              {t("Loading offers…")}
            </p>
          ) : state.status === "error" ? (
            <div className="px-2 py-5 text-center text-sm text-ink-muted" data-offers-state="error">
              <p>{t("Offers could not be loaded. Please try again.")}</p>
              <button
                type="button"
                onClick={load}
                className="mt-3 inline-flex min-h-10 items-center rounded-full border border-forest/30 px-4 font-semibold text-forest hover:bg-cream"
              >
                {t("Try again")}
              </button>
            </div>
          ) : state.items.length === 0 ? (
            <div className="px-2 py-6 text-center" data-offers-state="empty">
              <Tag aria-hidden="true" className="mx-auto size-7 text-brass" />
              <p className="mt-2 text-sm text-ink-muted">{t("No special offers are available at the moment.")}</p>
            </div>
          ) : (
            <ul className="space-y-3" data-offers-state="list">
              {state.items.map((o) => {
                const off = discount(o);
                const benefit = o.benefit ? pick(o.benefit, o.translations, "benefit") : null;
                const description = o.description ? pick(o.description, o.translations, "description") : null;
                return (
                  <li key={o.id} data-offer className="rounded-xl border border-line/70 bg-white p-3.5">
                    <p className="font-semibold text-charcoal">{pick(o.title, o.translations, "title")}</p>
                    {benefit || off ? (
                      <p className="mt-0.5 text-sm font-semibold text-logo-red">{benefit ?? off}</p>
                    ) : null}
                    {description ? (
                      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-ink-muted">{description}</p>
                    ) : null}
                    {o.promoCode ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="sr-only">{t("Promo code")}:</span>
                        <code
                          data-no-i18n
                          className="flex min-h-10 min-w-0 flex-1 items-center rounded-lg border border-dashed border-brass bg-cream/70 px-3 font-mono text-sm font-semibold tracking-wider break-all text-forest"
                        >
                          {o.promoCode}
                        </code>
                        <button
                          type="button"
                          onClick={() => copy(o.promoCode!)}
                          data-copy-code
                          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-forest px-3 text-sm font-semibold whitespace-nowrap text-white hover:bg-forest-800"
                        >
                          {copied === o.promoCode ? (
                            <Check aria-hidden="true" className="size-4" />
                          ) : (
                            <Copy aria-hidden="true" className="size-4" />
                          )}
                          {copied === o.promoCode ? t("Copied") : t("Copy code")}
                        </button>
                      </div>
                    ) : null}
                    <ul className="mt-2.5 space-y-1 text-xs text-ink-muted">
                      {o.endsOn ? <li>{t("Valid until {date}", { date: date(o.endsOn) })}</li> : null}
                      {o.minPurchaseLkr ? (
                        <li>{t("Minimum purchase: {amount}", { amount: formatLkr(o.minPurchaseLkr.toFixed(2)) })}</li>
                      ) : null}
                      <li>
                        {t("Applies to:")}{" "}
                        {o.appliesTo === "all" ? (
                          t("All products")
                        ) : (
                          <>
                            {[
                              ...o.categories.map((c) => (
                                <SiteLink
                                  key={`c-${c.slug}`}
                                  href={categoryHref(c.slug)}
                                  onClick={() => setOpen(false)}
                                  className="font-semibold text-forest underline underline-offset-2"
                                >
                                  {c.name}
                                </SiteLink>
                              )),
                              ...o.products.map((p) => (
                                <SiteLink
                                  key={`p-${p.slug}`}
                                  href={productHref(p.slug)}
                                  onClick={() => setOpen(false)}
                                  className="font-semibold text-forest underline underline-offset-2"
                                >
                                  {p.name}
                                </SiteLink>
                              )),
                            ].flatMap((el, i) => (i ? [<span key={`s${i}`}>, </span>, el] : [el]))}
                          </>
                        )}
                      </li>
                    </ul>
                    <SiteLink
                      href={o.promoCode ? quotationWithCodeHref(o.promoCode) : "/quotation/"}
                      onClick={() => setOpen(false)}
                      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-brass px-4 text-sm font-semibold text-charcoal hover:bg-gold-soft"
                    >
                      <FileText aria-hidden="true" className="size-4" />
                      {t("Request a Quotation")}
                    </SiteLink>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 px-1 text-[0.72rem] leading-relaxed text-ink-muted">
            {t("Prices, stock and the offer are confirmed by our staff when you request a quotation.")}
          </p>
          <p className="sr-only" aria-live="polite">
            {copied ? t("Promo code {code} copied.", { code: copied }) : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
