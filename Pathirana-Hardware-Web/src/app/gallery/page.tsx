import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { business } from "@/content/business";
import { images } from "@/lib/images";
import { getGalleryCollections } from "@/lib/gallery-collections";
import { createPageMetadata } from "@/lib/metadata";
import { ImageHero } from "@/components/ui/ImageHero";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { FacebookIcon } from "@/components/ui/FacebookIcon";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Gallery",
    description: `Photographs of ${business.legalName} on Pallama Road, Bangadeniya, Sri Lanka, with illustrations of the building materials and hardware we supply.`,
    path: "/gallery/",
  }),
};

/** Gallery (approved reference): image hero · filters · editorial collage with lightbox. */
export default function GalleryPage() {
  const collections = getGalleryCollections();
  const total = collections.reduce((n, c) => n + c.images.length, 0);

  return (
    <>
      <ImageHero
        id="gallery-hero-title"
        image={images.storeInterior}
        tone="[--hero-tone:#072e1d]"
        position="object-[50%_60%] lg:object-[60%_55%]"
        builtInCurve={false}
        crumb="Gallery"
        note="Illustration"
        title={
          <>
            Inside <span className="text-gold-soft">Pathirana Hardware</span>
          </>
        }
        intro={<p>Our store on Pallama Road, Bangadeniya, and the materials and hardware we supply.</p>}
      />

      <section aria-labelledby="gallery-title" className="bg-cream pt-10 pb-20 lg:pt-12 lg:pb-24">
        <Container size="wide">
          <h2 id="gallery-title" className="sr-only">
            Gallery
          </h2>
          {total ? (
            <GalleryBrowser collections={collections} />
          ) : (
            <div role="status" className="reveal mx-auto max-w-xl py-10 text-center">
              <Camera aria-hidden="true" className="mx-auto size-9 text-brass-ink" />
              <h3 className="mt-4 font-display text-3xl font-medium text-charcoal">Photographs coming soon</h3>
              <p className="mt-3 text-ink-muted">
                We only share real photographs of our own store. Follow our Facebook page for updates.
              </p>
              <div className="mt-6">
                <Button href={business.social.facebook} external icon={<FacebookIcon />} arrow="external">
                  Visit our Facebook page
                </Button>
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
