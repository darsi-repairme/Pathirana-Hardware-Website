"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Languages } from "lucide-react";
import { LOCALE_META, LOCALES, type Locale } from "./config";
import { useLocale } from "./I18nProvider";

/**
 * Language selector (English · தமிழ் · සිංහල): ONE circular icon button styled exactly like the
 * header's WhatsApp / Call buttons (`.header-action`), opening a compact dropdown. Used at every
 * width. Switching re-renders the page in place (same URL, no reload) and is remembered.
 * Keyboard: Enter / Space / ↓ opens, ↑ ↓ Home End move, Esc or Tab closes; clicking outside closes.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const label = t("Language");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes the menu wherever focus is (e.g. still on the button) and returns focus.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // Focus the current language when the menu opens.
    requestAnimationFrame(() => items.current[LOCALES.indexOf(locale)]?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, locale]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const choose = (l: Locale) => {
    setLocale(l);
    close();
  };
  const onMenuKey = (e: KeyboardEvent) => {
    const i = items.current.findIndex((el) => el === document.activeElement);
    const go = (n: number) => items.current[(n + LOCALES.length) % LOCALES.length]?.focus();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      go(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(LOCALES.length - 1);
    } else if (e.key === "Tab") close(false);
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        data-lang-button
        className="header-action"
      >
        <Languages aria-hidden="true" />
        <span className="sr-only">
          {label}: {LOCALE_META[locale].native}
        </span>
      </button>
      <div
        id={id}
        role="menu"
        aria-label={label}
        data-lang-menu
        data-open={open || undefined}
        hidden={!open}
        onKeyDown={onMenuKey}
        className="lang-menu absolute top-full right-0 z-50 mt-2 w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gold-soft/40 bg-paper p-1 text-charcoal shadow-[var(--shadow-lift)]"
      >
        {LOCALES.map((l, i) => {
          const active = l === locale;
          return (
            <button
              key={l}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              lang={LOCALE_META[l].htmlLang}
              tabIndex={-1}
              onClick={() => choose(l)}
              className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold transition-colors outline-none hover:bg-cream focus-visible:bg-cream ${
                active ? "bg-forest-50 text-forest" : "text-charcoal/85"
              }`}
            >
              {LOCALE_META[l].native}
              {active ? <Check aria-hidden="true" className="size-4 text-brass" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
