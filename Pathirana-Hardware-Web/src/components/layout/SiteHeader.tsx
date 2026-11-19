import { Phone } from "lucide-react";
import { business, whatsappChatHref, telHref } from "@/content/business";
import { WhatsAppOutlineIcon } from "@/components/ui/WhatsAppIcon";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { SiteLink } from "@/components/ui/SiteLink";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { HeaderSearch } from "./HeaderSearch";
import { MobileSearch } from "./MobileSearch";

/**
 * Header (first visible section): logo + name · main navigation · product
 * search, WhatsApp and call icons. Below xl the search collapses to an
 * icon; below lg the navigation, WhatsApp and call actions move into the
 * menu drawer (phones/tablets: logo + name · search · menu).
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
          {/* Full two-line brand at every width (name + gold "(Pvt) Ltd."). */}
          <span className="min-w-0 leading-tight">
            <span className="block font-display text-[clamp(1rem,4.9vw,1.2rem)] font-semibold whitespace-nowrap text-white sm:text-[1.35rem]">
              Pathirana Hardware
            </span>
            <span className="block text-[0.6rem] font-semibold tracking-[0.16em] text-gold-soft uppercase sm:text-[0.66rem] sm:tracking-[0.2em]">
              (Pvt) Ltd.
            </span>
          </span>
        </SiteLink>

        <nav aria-label="Main" className="hidden lg:block">
          <NavLinks />
        </nav>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <HeaderSearch className="hidden w-56 xl:block 2xl:w-64" />
          <div className="xl:hidden">
            <MobileSearch />
          </div>
          {/* Below lg WhatsApp and Call live in the menu drawer instead. */}
          <a href={whatsappChatHref} target="_blank" rel="noopener noreferrer" className="header-action max-lg:hidden">
            <WhatsAppOutlineIcon />
            <span className="sr-only">Chat on WhatsApp {business.phone.display} (opens in a new tab)</span>
          </a>
          <a href={telHref} className="header-action max-lg:hidden">
            <Phone aria-hidden="true" />
            <span className="sr-only">Call {business.phone.display}</span>
          </a>
          <div className="lg:hidden">
            <MobileMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}
