import type { Metadata } from "next";
import { CircleHelp, Phone } from "lucide-react";
import { business, telHref, whatsappChatHref } from "@/content/business";
import { faqGroups } from "@/content/faq";
import { createPageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { EnquiryCta } from "@/components/contact/EnquiryCta";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "FAQ",
    description: `Answers to common questions about ${business.shortName}: products, prices and availability, delivery, bulk orders, reservations and WhatsApp enquiries.`,
    path: "/faq/",
  }),
};

import { T, TRegion } from "@/i18n/I18nProvider";

export default function FaqPage() {
  return (
    <>
      <PageHero
        crumb="FAQ"
        parents={[{ label: "Contact Us", href: "/contact/" }]}
        eyebrow="Help"
        title={
          <>
            <T>Frequently asked</T> <span className="text-gold-soft italic">{<T>questions</T>}</span>
          </>
        }
        intro={
          <p>
            <T>
              Quick answers about our products, services and how to enquire. For anything not covered here — including
              prices, availability and delivery terms — please contact the store.
            </T>
          </p>
        }
      >
        <Button
          href={whatsappChatHref}
          external
          variant="gold"
          icon={<WhatsAppIcon />}
          className="!bg-[#177a42] !text-white hover:!bg-[#11653a]"
        >
          Chat on WhatsApp
        </Button>
        <Button href={telHref} variant="outlineLight" icon={<Phone />}>
          <T vars={{ phone: business.phone.display }}>{"Call {phone}"}</T>
        </Button>
      </PageHero>

      <TRegion as="section" label="Questions and answers" className="bg-cream py-16 lg:py-24">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            {/* Topic navigation */}
            <TRegion as="nav" label="FAQ topics" className="lg:col-span-3">
              <div className="rounded-[var(--radius-card)] border border-line/70 bg-white p-5 lg:sticky lg:top-32">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-brass-ink uppercase">
                  <CircleHelp aria-hidden="true" className="size-4" /> <T>Topics</T>
                </p>
                <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
                  {faqGroups.map((g) => (
                    <li key={g.id}>
                      <a
                        href={`#${g.id}`}
                        className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm font-semibold text-forest transition-colors duration-200 hover:border-brass hover:bg-cream lg:w-full lg:rounded-xl lg:border-transparent"
                      >
                        <T>{g.title}</T>
                        <span className="ml-2 text-xs font-medium text-ink-muted">{g.items.length}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </TRegion>

            <div className="space-y-14 lg:col-span-9">
              {faqGroups.map((g) => (
                <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className="reveal scroll-mt-32">
                  <h2
                    id={`${g.id}-title`}
                    className="flex items-center gap-3 font-display text-3xl font-medium text-charcoal sm:text-[2.2rem]"
                  >
                    <span aria-hidden="true" className="h-px w-8 bg-brass" />
                    <T>{g.title}</T>
                  </h2>
                  <div className="mt-6">
                    <FaqAccordion items={g.items} />
                  </div>
                </section>
              ))}
            </div>
          </div>
        </Container>
      </TRegion>

      <EnquiryCta
        eyebrow="Still have a question?"
        title="Ask the store directly"
        intro="Call or WhatsApp us — we will help with prices, availability and anything else you need to know."
      />
    </>
  );
}
