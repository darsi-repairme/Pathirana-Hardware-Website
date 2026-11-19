"use client";

import { SiteLink } from "@/components/ui/SiteLink";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { mainNav } from "@/content/navigation";
import { business, mailHref, mapsHref, telHref, whatsappChatHref } from "@/content/business";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { isActivePath } from "./NavLinks";

/**
 * Mobile navigation drawer built on the native <dialog> element:
 * focus is trapped while open, Escape closes it, the page behind is inert
 * (and its scrolling locked — see globals.css), and focus returns to the menu
 * button on close. Below lg the header's WhatsApp and Call actions live here.
 */
export function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname() ?? "/";

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
        <span className="sr-only">Open menu</span>
      </button>

      <dialog
        ref={dialogRef}
        id="mobile-menu"
        aria-label="Site menu"
        // Clicking the backdrop (the dialog element itself) closes the menu.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="ph-dialog ph-drawer on-dark fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(20rem,86vw)] max-w-none overflow-x-hidden overflow-y-auto rounded-l-3xl bg-forest-900 p-0 text-white shadow-2xl"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-white/10 pr-3 pl-5">
            <p className="text-xs font-semibold tracking-[0.22em] text-gold-soft uppercase">Menu</p>
            <button
              type="button"
              onClick={close}
              autoFocus
              className="inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">Close menu</span>
            </button>
          </div>

          <nav aria-label="Mobile" className="px-3 py-3">
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
                      {item.label}
                    </SiteLink>
                  </li>
                );
              })}
            </ul>
          </nav>

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
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-gold-soft" /> Pallama Road, Bangadeniya
                  <span className="sr-only"> (opens Google Maps in a new tab)</span>
                </a>
              </li>
            </ul>

            {/* Contact actions: identical size, WhatsApp green · Call brass. */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <a
                href={whatsappChatHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#177a42] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#11653a]"
              >
                <WhatsAppIcon className="size-[1.1rem] shrink-0" />
                WhatsApp
                <span className="sr-only"> {business.phone.display} (opens in a new tab)</span>
              </a>
              <a
                href={telHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brass px-3 text-sm font-semibold text-charcoal transition-colors hover:bg-gold-soft"
              >
                <Phone aria-hidden="true" className="size-[1.1rem] shrink-0" />
                Call Now
                <span className="sr-only"> {business.phone.display}</span>
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
