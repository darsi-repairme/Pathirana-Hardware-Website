import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Boxes,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircleQuestion,
  Phone,
  Truck,
} from "lucide-react";
import { business, mailHref, mapsHref, telHref, whatsappChatHref } from "@/content/business";
import { allFaqItems, faqPreviewIds } from "@/content/faq";
import { images } from "@/lib/images";
import { createPageMetadata } from "@/lib/metadata";
import { BlurredTopBand } from "@/components/ui/BlurredTopBand";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { InView } from "@/components/ui/InView";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { SocialIcon, socialLinks } from "@/components/ui/SocialIcons";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { LocationVisual } from "@/components/home/LocationVisual";
import { ConstructionSkyline } from "@/components/home/ConstructionSkyline";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Contact Us",
    description: `Contact ${business.legalName}: call or WhatsApp ${business.phone.display}, email ${business.email}, or visit us on Pallama Road, Bangadeniya, Sri Lanka.`,
    path: "/contact/",
  }),
};

const faqItems = faqPreviewIds.map((id) => allFaqItems.find((f) => f.id === id)).filter((f) => f !== undefined);
const faqIcons = {
  delivery: Truck,
  bulk: Boxes,
  reservations: Bookmark,
  guidance: Lightbulb,
  "how-to-contact": MessageCircleQuestion,
};

/** Centred section heading: gold rule + serif title. */
function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="reveal text-center">
      <span aria-hidden="true" className="mx-auto block h-0.5 w-12 bg-brass" />
      <h2
        id={id}
        className="mt-4 font-display text-[clamp(1.75rem,5vw,2.4rem)] leading-tight font-semibold text-forest"
      >
        {children}
      </h2>
    </div>
  );
}

/** Email addresses wrap after "@" rather than mid-word. */
function Email({ value }: { value: string }) {
  const at = value.indexOf("@") + 1;
  return (
    <>
      {value.slice(0, at)}
      <wbr />
      {value.slice(at)}
    </>
  );
}

/**
 * Contact (approved reference): hero · Call / WhatsApp / Email · location with
 * the Home page's 3D location scene · social links · FAQ · gold skyline into
 * the footer.
 */
export default function ContactPage() {
  const methods = [
    {
      title: "Call Us",
      icon: <Phone aria-hidden="true" className="size-6" />,
      badge: "bg-forest text-gold-soft",
      value: business.phone.display,
      text: "Speak to the store about products, prices and availability.",
      action: (
        <Button href={telHref} icon={<Phone />} className="w-full">
          Call Now
        </Button>
      ),
    },
    {
      title: "WhatsApp",
      icon: <WhatsAppIcon className="size-6" />,
      badge: "bg-[#177a42] text-white",
      value: business.phone.display,
      text: "Send the items, sizes and quantities you need.",
      action: (
        <Button
          href={whatsappChatHref}
          external
          icon={<WhatsAppIcon />}
          className="w-full !bg-[#177a42] !text-white hover:!bg-[#11653a]"
        >
          Chat on WhatsApp
        </Button>
      ),
    },
    {
      title: "Email Us",
      icon: <Mail aria-hidden="true" className="size-6" />,
      badge: "bg-brass text-forest-900",
      value: <Email value={business.email} />,
      text: "For written enquiries and material lists.",
      action: (
        <Button href={mailHref} variant="gold" icon={<Mail />} className="w-full">
          Send an Email
        </Button>
      ),
    },
  ];

  return (
    <>
      {/* Top section: Get in Touch — heading over a blurred store photo, then the
          three contact methods as open columns split by fine gold rules. */}
      <section aria-labelledby="contact-methods">
        <BlurredTopBand
          id="contact-methods"
          image={images.contactHero}
          position="object-[60%_30%]"
          crumb="Contact Us"
          title="Get in Touch"
          intro={<p>We&apos;re here to help with your building and hardware needs.</p>}
        />
        <div className="bg-cream pt-10 pb-14 lg:pt-14 lg:pb-20">
          <Container size="wide">
            <ul className="grid divide-y divide-brass/25 md:grid-cols-3 md:divide-x md:divide-y-0 lg:mt-10">
              {methods.map((m) => (
                <li
                  key={m.title}
                  className="reveal flex min-w-0 flex-col items-center py-8 text-center md:px-6 md:py-2 lg:px-10"
                >
                  <span
                    className={`inline-flex size-16 items-center justify-center rounded-full shadow-[var(--shadow-card)] ${m.badge}`}
                  >
                    {m.icon}
                  </span>
                  <h2 className="mt-5 text-xs font-semibold tracking-[0.22em] text-brass-ink uppercase">{m.title}</h2>
                  <p className="mt-2 font-display text-[clamp(1.3rem,4.6vw,1.55rem)] leading-tight font-semibold [overflow-wrap:anywhere] text-charcoal">
                    {m.value}
                  </p>
                  <p className="mt-2 max-w-xs flex-1 text-ink-muted">{m.text}</p>
                  <div className="mt-5 w-full max-w-[16.5rem]">{m.action}</div>
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </section>

      {/* Location — the Home page's 3D location scene (shared LocationVisual). */}
      <section id="find-us" aria-labelledby="find-us-title" className="scroll-mt-28 bg-cream-deep/60 py-14 lg:py-20">
        <Container size="wide">
          {/* Phones: heading → address → 3D scene → Get Directions (the text
              column is display:contents so its parts share one ordered column). */}
          <InView className="reveal-group grid items-center md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
            <div data-three-hover className="rv d1 min-w-0 max-md:order-1 max-md:mt-2 md:order-2">
              <LocationVisual className="h-52 w-full min-[480px]:h-60 sm:h-72 lg:h-[22rem]" />
            </div>
            <div className="max-md:contents md:order-1 lg:pl-8">
              <span aria-hidden="true" className="rv-line block h-0.5 w-12 origin-left bg-brass" />
              <h2
                id="find-us-title"
                className="rv mt-4 font-display text-[clamp(1.9rem,5vw,2.6rem)] font-semibold text-forest"
              >
                Find Our Store
              </h2>
              <address className="rv d2 mt-4 space-y-2.5 text-lg text-charcoal not-italic">
                <span className="flex items-start gap-2.5">
                  <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-brass" />
                  <span>
                    <span className="block font-semibold text-forest">{business.shortName}</span>
                    {business.address.street}, {business.address.locality}, {business.address.country}
                  </span>
                </span>
                <span className="flex items-start gap-2.5">
                  <Phone aria-hidden="true" className="mt-1 size-5 shrink-0 text-brass" />
                  <a href={telHref} className="transition-colors hover:text-forest">
                    {business.phone.display}
                  </a>
                </span>
              </address>
              <p className="rv d2 mt-3 max-w-md text-sm leading-relaxed text-ink-muted max-md:order-3">
                Please call to confirm opening times before you travel.
              </p>
              <div className="rv d3 mt-6 max-md:order-2 max-md:mt-3">
                <Button href={mapsHref} external variant="gold" arrow={false}>
                  Get Directions
                  <ArrowRight aria-hidden="true" className="ml-2 inline size-4" />
                </Button>
              </div>
            </div>
          </InView>
        </Container>
      </section>

      {/* Social media */}
      <section aria-labelledby="follow-us" className="bg-cream py-12 lg:py-14">
        <Container size="wide">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
            <h2 id="follow-us" className="font-display text-2xl font-semibold text-forest">
              Follow Us
            </h2>
            <span aria-hidden="true" className="hidden h-10 w-px bg-brass/40 sm:block" />
            <ul className="flex items-center gap-3 sm:gap-4">
              {socialLinks.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex size-12 items-center justify-center rounded-full border-[1.5px] border-forest/30 text-forest transition-colors duration-200 hover:border-brass hover:bg-brass hover:text-forest-900"
                  >
                    <SocialIcon name={s.name} className="size-5" />
                    <span className="sr-only">{s.label} — Pathirana Hardware (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* FAQ, ending in the gold construction skyline above the footer. */}
      <section
        aria-labelledby="contact-faq-title"
        className="relative isolate overflow-hidden bg-cream pt-4 pb-32 sm:pb-36 lg:pb-[clamp(9rem,12vw,11.5rem)]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 -z-10 h-[40%] bg-gradient-to-t from-brass-100/60 to-transparent"
        />
        <ConstructionSkyline className="skyline-fade absolute inset-x-0 bottom-0 -z-10 h-24 w-full text-brass/45 sm:h-28 lg:aspect-[1440/150] lg:h-auto lg:text-brass/60" />
        <Container>
          <Heading id="contact-faq-title">Frequently Asked Questions</Heading>
          <div className="reveal mx-auto mt-8 max-w-3xl">
            <FaqAccordion items={faqItems} variant="rows" icons={faqIcons} />
          </div>
          <p className="reveal mt-6 text-center">
            <Link
              href="/faq/"
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-forest underline-offset-4 hover:underline"
            >
              View all FAQs <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </p>
        </Container>
      </section>
    </>
  );
}
