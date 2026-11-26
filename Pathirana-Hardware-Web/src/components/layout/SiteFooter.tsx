import Image from "next/image";
import { ChevronRight, Mail, MapPin, Phone } from "lucide-react";
import { business, mailHref, mapsHref, telHref, whatsappChatHref } from "@/content/business";
import { footerNav } from "@/content/navigation";
import { FooterServices } from "./FooterServices";
import { images } from "@/lib/images";
import { Logo } from "@/components/ui/Logo";
import { SiteLink } from "@/components/ui/SiteLink";
import { SocialLinks } from "@/components/ui/SocialIcons";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { CurrentYear } from "@/components/ui/CurrentYear";
import { T, TRegion } from "@/i18n/I18nProvider";

/** Copyright line shows the customer-facing brand name (2026-11-20 request; previously "RepairMe (Pvt) Ltd."). */
/**
 * Copyright attribution requested by the owner (2026-11-21). Customer-facing branding elsewhere
 * stays "Pathirana Hardware". PENDING final client/legal confirmation before production.
 */
const COPYRIGHT_HOLDER = "RepairMe (Pvt) Ltd";

/** Shared centred container: same max width as the header, fluid side padding. */
const frame = "mx-auto w-full max-w-[1440px] px-[clamp(1.5rem,4vw,4.5rem)]";
const heading = "text-sm font-semibold tracking-[0.12em] text-gold-soft uppercase";
const list = "mt-5 space-y-2.5 text-[0.95rem] leading-6";
const link = "transition-colors duration-200 hover:text-gold-soft";

/**
 * Site footer.
 *  • Background: the header's own colour token, forest-900 (#072e1d).
 *  • Artwork (lg+): the supplied gold construction panorama with its baked-in green
 *    made transparent (scripts/prepare-brand-assets.mjs) — static, anchored to
 *    the bottom at its natural aspect, softened and faded behind the content
 *    so the gold scenes frame the footer's lower corners.
 *  • Layout: one centred grid — 4 columns (lg), 2 (sm–md); on phones the brand
 *    and contact blocks span both columns and the two link lists pair up — and a
 *    full-width copyright bar aligned to the same container.
 */
export function SiteFooter() {
  // Build year in the static HTML; CurrentYear updates it in the browser.
  const year = new Date().getFullYear();

  return (
    <footer className="on-dark relative isolate overflow-clip bg-forest-900 text-cream">
      {/* Static decorative artwork (no animation). From lg: the full panorama
          along the bottom (approved desktop design). */}
      <div
        aria-hidden="true"
        className="footer-artwork pointer-events-none absolute inset-x-0 bottom-0 -z-10 max-lg:hidden"
      >
        <Image
          src={images.footerArtwork.src}
          width={images.footerArtwork.width}
          height={images.footerArtwork.height}
          alt=""
          sizes="100vw"
          className="block h-auto w-full"
        />
      </div>
      {/* Below lg the footer is tall and narrow, so the wide panorama would only
          be a thin strip. Two crops of the same artwork frame it instead: the
          scaffolding and bricks (left of the panorama) faintly behind the brand
          at the top right, and the crane and tools (right of the panorama)
          rising from the bottom behind the contact block and copyright. */}
      <div
        aria-hidden="true"
        className="footer-art-top pointer-events-none absolute top-0 right-0 -z-10 h-56 w-[85%] sm:h-64 sm:w-[60%] lg:hidden"
      >
        <Image src={images.footerArtwork.src} alt="" fill sizes="85vw" className="object-cover object-left" />
      </div>
      <div
        aria-hidden="true"
        className="footer-art-bottom pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[clamp(14rem,62vw,22rem)] lg:hidden"
      >
        <Image src={images.footerArtwork.src} alt="" fill sizes="100vw" className="object-cover object-right" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-brass to-transparent"
      />

      <div
        className={`${frame} grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-x-[clamp(1.25rem,3.5vw,4rem)] gap-y-8 pt-12 pb-8 sm:grid-cols-2 sm:gap-y-10 sm:pt-14 sm:pb-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)_minmax(0,1.15fr)_minmax(0,1.2fr)] lg:pt-[4.5rem] lg:pb-12`}
      >
        {/* 1 · Brand (full width on phones; the two link lists then sit side by side) */}
        <div className="col-span-2 sm:col-span-1">
          <SiteLink href="/" className="inline-flex items-center gap-3 rounded-lg">
            <Logo tone="mark" className="h-12" alt="" sizes="96px" />
            <span className="leading-tight">
              <span className="block font-display text-xl font-semibold whitespace-nowrap text-cream">
                Pathirana Hardware
              </span>
            </span>
          </SiteLink>
          <p className="mt-5 font-display text-lg text-gold-soft italic">
            “<T>{business.tagline}</T>”
          </p>
          <p className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-cream/85">
            <T>Hardware and building materials for homes and construction projects.</T>
          </p>
          <p className="mt-3 text-sm font-semibold text-cream/70">
            <T>Established 16 April 1997</T>
          </p>
        </div>

        {/* 2 · Quick links */}
        <TRegion as="nav" label="Footer">
          <h2 className={heading}>
            <T>Quick Links</T>
          </h2>
          <ul className={list}>
            {footerNav.map((item) => (
              <li key={item.href}>
                <SiteLink href={item.href} className={`group inline-flex items-center gap-2 ${link}`}>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-gold-soft transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                  <T>{item.label}</T>
                </SiteLink>
              </li>
            ))}
          </ul>
        </TRegion>

        {/* 3 · Services */}
        <TRegion as="nav" label="Our services">
          <h2 className={heading}>
            <T>Our Services</T>
          </h2>
          <FooterServices list={list} link={link} />
        </TRegion>

        {/* 4 · Contact & follow */}
        <div className="col-span-2 sm:col-span-1">
          <h2 className={heading}>
            <T>Contact Us</T>
          </h2>
          <ul className={list}>
            <li>
              <a href={telHref} className={`flex items-center gap-3 ${link}`}>
                <Phone aria-hidden="true" className="size-4 shrink-0 text-gold-soft" />
                {business.phone.display}
              </a>
            </li>
            <li>
              <a
                href={whatsappChatHref}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 ${link}`}
              >
                <WhatsAppIcon className="size-4 shrink-0 text-gold-soft" />
                <T>WhatsApp</T> {business.phone.display}
                <span className="sr-only">
                  {" "}
                  <T>(opens in a new tab)</T>
                </span>
              </a>
            </li>
            <li>
              <a href={mailHref} className={`flex items-center gap-3 [overflow-wrap:anywhere] ${link}`}>
                <Mail aria-hidden="true" className="size-4 shrink-0 text-gold-soft" />
                {/* Prefer breaking after "@" in narrow columns. */}
                <span>
                  {business.email.split("@")[0]}@<wbr />
                  {business.email.split("@")[1]}
                </span>
              </a>
            </li>
            <li>
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" className={`flex gap-3 ${link}`}>
                <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-gold-soft" />
                <address className="not-italic">
                  <T>{`${business.address.street}, ${business.address.locality}, ${business.address.country}`}</T>
                  <span className="sr-only">
                    {" "}
                    <T>(opens Google Maps search in a new tab)</T>
                  </span>
                </address>
              </a>
            </li>
          </ul>
          <h2 className={`${heading} mt-7`}>
            <T>Follow Us</T>
          </h2>
          <SocialLinks className="mt-4" />
        </div>
      </div>

      {/* Bottom bar: centred copyright (legal-page links removed by request). */}
      <div className="border-t border-gold-soft/15">
        <div className={`${frame} pt-4 pb-[clamp(7.5rem,33vw,10rem)] text-center text-[0.82rem] text-cream/70 lg:pb-6`}>
          <p data-copyright className="mx-auto max-w-full text-center text-balance">
            © <CurrentYear initial={year} /> {COPYRIGHT_HOLDER}. <T>All rights reserved.</T>
          </p>
        </div>
      </div>
    </footer>
  );
}
