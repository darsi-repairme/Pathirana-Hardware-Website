import type { Metadata } from "next";
import { Info } from "lucide-react";
import { business } from "@/content/business";
import { images } from "@/lib/images";
import { createPageMetadata } from "@/lib/metadata";
import { BlurredTopBand } from "@/components/ui/BlurredTopBand";
import { Container } from "@/components/ui/Container";
import { ServicesShowcase } from "@/components/services/ServicesShowcase";
import { ServicesList } from "@/components/services/ServicesList";
import { EnquirySteps } from "@/components/services/EnquirySteps";
import { SeeMoreServices } from "@/components/services/SeeMoreServices";
import { T } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Services",
    description: `Building material supply, home and site delivery, bulk orders, product reservations, product advice and contractor support at ${business.shortName}, Bangadeniya. Call or WhatsApp the store for details.`,
    path: "/services/",
  }),
};

/** Centred section heading: gold rule + serif title (+ optional line). */
function Heading({ id, title, intro }: { id: string; title: string; intro?: string }) {
  return (
    <div className="reveal mx-auto max-w-2xl text-center">
      <span aria-hidden="true" className="mx-auto block h-0.5 w-12 bg-brass" />
      <h2
        id={id}
        className="mt-4 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-tight font-semibold text-forest"
      >
        <T>{title}</T>
      </h2>
      {intro ? (
        <p className="mt-3 text-ink-muted">
          <T>{intro}</T>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Services (approved reference): image hero · the circular 360° showcase ·
 * all six services with View Service / Enquire · how to enquire.
 */
export default function ServicesPage() {
  return (
    <>
      {/* Top section: Our Services — heading over a blurred construction photo,
          then the circular 360° presentation (one service at a time). */}
      <section aria-labelledby="services-showcase-title">
        <BlurredTopBand
          id="services-showcase-title"
          image={images.heroConstruction}
          position="object-[50%_45%]"
          crumb="Services"
          title="Our Services"
          intro={
            <p>
              <T>Six ways we can help with your construction and home projects.</T>
            </p>
          }
        />
        <div className="bg-cream pt-10 pb-16 lg:pt-14 lg:pb-24">
          <Container size="wide">
            <ServicesShowcase />
          </Container>
        </div>
      </section>

      {/* All six services — open rows split by hairlines, two equal actions each. */}
      <section aria-labelledby="all-services-title" className="bg-cream-deep/60 py-16 lg:py-20">
        <Container size="wide">
          <Heading id="all-services-title" title="All Services" />
          <ServicesList />
          <SeeMoreServices className="reveal mt-10" />
        </Container>
      </section>

      {/* How to enquire */}
      <section aria-labelledby="how-to-enquire" className="bg-cream py-16 lg:py-20">
        <Container size="wide">
          <EnquirySteps id="how-to-enquire" />
          <p className="reveal mx-auto mt-8 flex max-w-3xl gap-3 text-sm leading-relaxed text-ink-muted">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brass-ink" />
            <span>
              <T>No online orders or payments. Delivery, bulk and reservation details are confirmed per enquiry.</T>
            </span>
          </p>
        </Container>
      </section>
    </>
  );
}
