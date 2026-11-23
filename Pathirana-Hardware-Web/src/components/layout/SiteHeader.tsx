import { Phone } from "lucide-react";
import { business, telHref } from "@/content/business";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { SiteLink } from "@/components/ui/SiteLink";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { HeaderSearch } from "./HeaderSearch";
import { MobileSearch } from "./MobileSearch";
import { OffersMenu } from "./OffersMenu";
import { T, TRegion } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

/**
 * Header (first visible section): logo + name · main navigation · product search, Offers,
 * language and Call. Below xl the search collapses to an icon; below lg the navigation, the
 * language choice and Call move into the menu drawer (phones/tablets: logo · search · offers · menu).
 */
export function SiteHeader() {
  return (
    <header className="header-scroll on-dark sticky top-0 z-40 border-b border-white/10 bg-forest-900/95 text-white backdrop-blur supports-[backdrop-filter]:bg-forest-900/90">
      <Container size="wide" className="flex h-[var(--header-h)] items-center justify-between gap-2 sm:gap-4">
        <SiteLink
          href="/"
          className="flex min-h-11 min-w-0 shrink items-center gap-2 rounded-lg min-[360px]:gap-2.5 sm:gap-3"
        >
          <Logo tone="mark" className="h-9 shrink-0 sm:h-11" preload alt="" sizes="64px" />
          {/* Customer-facing brand name (the legal suffix is kept only in internal records). */}
          {/* Phones / tablets: two short lines beside the four header buttons; below 360 px the logo
              alone is shown (the name stays for screen readers). One line from md. */}
          <span className="min-w-0 max-[359px]:sr-only" data-brand-name>
            <span className="block font-display text-[1rem] leading-[1.08] font-semibold whitespace-nowrap text-white min-[400px]:text-[1.08rem] md:text-[1.35rem] md:leading-tight">
              <span className="block md:inline">Pathirana</span> <span className="block md:inline">Hardware</span>
            </span>
          </span>
        </SiteLink>

        <TRegion as="nav" label="Main" className="hidden lg:block">
          <NavLinks />
        </TRegion>

        {/* Search → Offers → Language → Call (desktop). Phones / tablets: Search · Offers · Menu, with
            the language choice and Call inside the menu. WhatsApp lives in the enquiry actions. */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2" data-header-actions>
          <HeaderSearch className="header-search-full hidden w-56 xl:block 2xl:w-64" />
          <div className="header-search-icon xl:hidden">
            <MobileSearch />
          </div>
          <OffersMenu />
          <LanguageSwitcher className="hidden lg:block" />
          {/* Call: desktop only; phones / tablets reach it inside the menu (keeps the bar uncrowded). */}
          <div className="hidden lg:block">
            <a href={telHref} className="header-action" data-header-call>
              <Phone aria-hidden="true" />
              <span className="sr-only">
                <T vars={{ phone: business.phone.display }}>{"Call {phone}"}</T>
              </span>
            </a>
          </div>
          <div className="lg:hidden">
            <MobileMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}
