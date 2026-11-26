import type { Metadata } from "next";
import { business } from "@/content/business";
import { images } from "@/lib/images";
import { createPageMetadata } from "@/lib/metadata";
import { ImageHero } from "@/components/ui/ImageHero";
import { Container } from "@/components/ui/Container";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { T, TRich } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Gallery",
    description: `Photographs of ${business.shortName} on Pallama Road, Bangadeniya, Sri Lanka, with illustrations of the building materials and hardware we supply.`,
    path: "/gallery/",
  }),
};

/** Gallery (approved reference): image hero · filters · editorial collage with lightbox. */
export default function GalleryPage() {
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
          <TRich nodes={{ name: <span className="text-gold-soft">Pathirana Hardware</span> }}>{"Inside {name}"}</TRich>
        }
        intro={
          <p>
            <T>Our store on Pallama Road, Bangadeniya, and the materials and hardware we supply.</T>
          </p>
        }
      />

      <section aria-labelledby="gallery-title" className="bg-cream pt-10 pb-20 lg:pt-12 lg:pb-24">
        <Container size="wide">
          <h2 id="gallery-title" className="sr-only">
            <T>Gallery</T>
          </h2>
          {/* Photos published in the Admin Gallery (live database only). */}
          <GalleryBrowser />
        </Container>
      </section>
    </>
  );
}
