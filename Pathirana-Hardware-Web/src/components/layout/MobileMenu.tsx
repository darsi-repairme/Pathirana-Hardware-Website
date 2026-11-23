"use client";

import { SiteLink } from "@/components/ui/SiteLink";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Check, Languages, Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { mainNav } from "@/content/navigation";
import { business, mailHref, mapsHref, telHref, whatsappChatHref } from "@/content/business";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { isActivePath } from "./NavLinks";
import { useLocale } from "@/i18n/I18nProvider";
import { LOCALE_META, LOCALES } from "@/i18n/config";

/**
 * Mobile navigation drawer built on the native <dialog> element:
 * focus is trapped while open, Escape closes it, the page behind is inert
 * (and its scrolling locked — see globals.css), and focus returns to the menu
 * button on close. Below lg the header's WhatsApp and Call actions live here.
 */
export function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname() ?? "/";
  const { t, locale, setLocale } = useLocale();

  // Close the menu after navigating to a new page.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-controls="mobile-menu"
        className="inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
      >
        <Menu aria-hidden="true" className="size-6" />
        <span className="sr-only">{t("Open menu")}</span>
      </button>

      <dialog
        ref={dialogRef}
        id="mobile-menu"
        aria-label={t("Site menu")}
        // Clicking the backdrop (the dialog element itself) closes the menu.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="ph-dialog ph-drawer on-dark fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(20rem,86vw)] max-w-none overflow-x-hidden overflow-y-auto rounded-l-3xl bg-forest-900 p-0 text-white shadow-2xl"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-white/10 pr-3 pl-5">
            <p className="text-xs font-semibold tracking-[0.22em] text-gold-soft uppercase">{t("Menu")}</p>
            <button
              type="button"
              onClick={close}
              autoFocus
              className="inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">{t("Close menu")}</span>
            </button>
          </div>

          <nav aria-label={t("Mobile")} className="px-3 py-3">
            <ul className="space-y-0.5">
              {mainNav.map((item, i) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <SiteLink
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold transition-colors ${
                        active ? "bg-white/[0.07] text-gold-soft" : "text-white/90 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-gold-soft"
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className="w-5 text-[0.7rem] font-semibold text-gold-soft/70 tabular-nums"
                      >
                        0{i + 1}
                      </span>
                      {t(item.label)}
                    </SiteLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Language (phones / tablets: the only language control — the header has none below lg). */}
          <section
            aria-labelledby="mobile-menu-language"
            className="border-t border-white/10 px-5 py-4"
            data-menu-language
          >
            <h2
              id="mobile-menu-language"
              className="flex items-center gap-2 text-xs font-semibold tracking-[0.22em] text-gold-soft uppercase"
            >
              <Languages aria-hidden="true" className="size-4" /> {t("Language")}
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {LOCALES.map((l) => {
                const on = l === locale;
                return (
                  <button
                    key={l}
                    type="button"
                    lang={LOCALE_META[l].htmlLang}
                    aria-pressed={on}
                    onClick={() => setLocale(l)}
                    className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border px-1.5 text-sm font-semibold transition-colors ${
                      on
                        ? "border-gold-soft bg-gold-soft/15 text-gold-soft"
                        : "border-white/20 text-white/85 hover:border-gold-soft/60 hover:text-white"
                    }`}
                  >
                    {on ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : null}
                    {LOCALE_META[l].native}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-auto border-t border-white/10 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <ul className="space-y-1 text-sm text-sage">
              <li>
                <a
                  href={mailHref}
                  className="flex min-h-10 items-center gap-3 [overflow-wrap:anywhere] hover:text-white"
                >
                  <Mail aria-hidden="true" className="size-4 shrink-0 text-gold-soft" /> {business.email}
                </a>
              </li>
              <li>
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-10 items-center gap-3 hover:text-white"
                >
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-gold-soft" />{" "}
                  {t("Pallama Road, Bangadeniya")}
                  <span className="sr-only"> {t("(opens Google Maps in a new tab)")}</span>
                </a>
              </li>
            </ul>

            {/* Contact actions, stacked full width so translated labels never wrap or squeeze:
                Call (phones / tablets: the only Call control — the header has none below lg) and
                WhatsApp, both one height. */}
            <div className="mt-4 grid gap-2.5" data-menu-contact>
              <a
                href={telHref}
                data-menu-call
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-brass px-4 py-2 text-charcoal transition-colors hover:bg-gold-soft"
              >
                <Phone aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 leading-tight">
                  <span className="block text-sm font-semibold">{t("Call Pathirana Hardware")}</span>
                  <span className="block text-sm font-medium tabular-nums">{business.phone.display}</span>
                </span>
              </a>
              <a
                href={whatsappChatHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-[#177a42] px-4 py-2 text-white transition-colors hover:bg-[#11653a]"
              >
                <WhatsAppIcon className="size-5 shrink-0" />
                <span className="min-w-0 text-sm leading-tight font-semibold">{t("Chat on WhatsApp")}</span>
                <span className="sr-only"> {t("{phone} (opens in a new tab)", { phone: business.phone.display })}</span>
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
