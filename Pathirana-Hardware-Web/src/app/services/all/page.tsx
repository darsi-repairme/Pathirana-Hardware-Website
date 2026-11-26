import type { Metadata } from "next";
import { Info } from "lucide-react";
import { business } from "@/content/business";
import { images } from "@/lib/images";
import { createPageMetadata } from "@/lib/metadata";
import { BlurredTopBand } from "@/components/ui/BlurredTopBand";
import { Container } from "@/components/ui/Container";
import { AllServicesGrid } from "@/components/services/AllServicesGrid";
import { T } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "All Services",
    description: `Every service offered by ${business.shortName}, Bangadeniya, with photos and details. Call or WhatsApp the store to ask about any of them.`,
    path: "/services/all/",
  }),
};

/**
 * "See More" from the Services sections: every published service as an image card. A static
 * segment, so it takes precedence over /services/[slug]/ (no service uses the slug "all").
 */
export default function AllServicesPage() {
  return (
    <section aria-labelledby="all-services-page-title">
      <BlurredTopBand
        id="all-services-page-title"
        image={images.heroConstruction}
        position="object-[50%_45%]"
        crumb="All Services"
        parents={[{ label: "Services", href: "/services/" }]}
        title="All Services"
        intro={
          <p>
            <T>Every service we offer, with photos and details. Call or WhatsApp the store to ask about any of them.</T>
          </p>
        }
      />
      <div className="bg-cream py-12 lg:py-16">
        <Container size="wide">
          <AllServicesGrid />
          <p className="mx-auto mt-12 flex max-w-3xl gap-3 text-sm leading-relaxed text-ink-muted">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brass-ink" />
            <span>
              <T>No online orders or payments. Delivery, bulk and reservation details are confirmed per enquiry.</T>
            </span>
          </p>
        </Container>
      </div>
    </section>
  );
}
