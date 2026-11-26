import { ArrowRight, MapPin, Phone } from "lucide-react";
import { business, mapsHref, telHref } from "@/content/business";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { LocationVisual } from "./LocationVisual";
import { ConstructionSkyline } from "./ConstructionSkyline";
import { Testimonials } from "./Testimonials";
import { HomeGalleryTiles } from "./HomeGalleryTiles";
import { T } from "@/i18n/I18nProvider";

/**
 * Home: Gallery (image-led collage) and, separately, What Our Customers Say
 * (typography-led) — two deliberately different designs (CEO review #11).
 */
export function GalleryFeedback() {
  return (
    <>
      <section aria-labelledby="gallery-preview-title" className="bg-cream pt-6 pb-14 lg:pb-20">
        <Container size="wide">
          <InView className="reveal-group">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <span aria-hidden="true" className="rv-line block h-0.5 w-12 origin-left bg-brass" />
                <h2
                  id="gallery-preview-title"
                  className="rv mt-4 font-display text-3xl font-semibold text-forest sm:text-[2.1rem] lg:text-[2.6rem]"
                >
                  <T>Our Gallery</T>
                </h2>
                <p className="rv d1 mt-2 text-ink-muted">
                  <T>A look inside the store.</T>
                </p>
              </div>
              <div className="rv d2">
                <Button href="/gallery/" variant="outline" arrow="right">
                  View Gallery
                </Button>
              </div>
            </div>

            {/* Phones: swipe sideways (snap); larger screens: collage — from the Admin Gallery. */}
            {/* The Admin Gallery's first five published photos (live database only). */}
            <HomeGalleryTiles />
          </InView>
        </Container>
      </section>

      <Testimonials />
    </>
  );
}

/**
 * Find Our Store — a full-width section (CEO review #12): the verified address,
 * phone and directions beside a large 3D map illustration (decorative, not a
 * real map), over a gold construction skyline along the bottom edge.
 */
export function FindStore() {
  return (
    <section
      aria-labelledby="find-store-title"
      className="relative isolate overflow-hidden bg-cream pt-12 pb-20 sm:pb-24 lg:pt-16 lg:pb-[clamp(6rem,8.5vw,9rem)]"
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 right-[-10%] -z-10 size-[min(48rem,110vw)] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.16),transparent_62%)]"
      />
      {/* Skyline the store "sits on": a soft gold ground wash, and the line-art
          fading in from the top so it grows out of the section. From lg it keeps
          its own proportions (nothing cropped); on narrow screens it is shorter
          and fainter, cropped to the houses and crane in the middle. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[45%] bg-gradient-to-t from-brass-100/50 to-transparent"
      />
      <ConstructionSkyline className="skyline-fade absolute inset-x-0 bottom-0 -z-10 aspect-[1440/150] h-auto w-full text-brass/40 lg:text-brass/55" />

      <Container size="wide">
        {/* Phones: heading → address → 3D map → Get Directions (the text column is
            display:contents so its parts and the map share one ordered column).
            From md: text left, a wider map right. */}
        <InView className="reveal-group grid items-center md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10">
          <div data-three-hover className="rv d1 min-w-0 max-md:order-1 max-md:mt-2 md:order-2">
            <LocationVisual className="h-52 w-full min-[480px]:h-60 sm:h-72 lg:h-[22rem]" />
          </div>
          <div className="max-md:contents md:order-1 lg:pl-8">
            <span aria-hidden="true" className="rv-line block h-0.5 w-12 origin-left bg-brass" />
            <h2
              id="find-store-title"
              className="rv mt-4 font-display text-3xl font-semibold text-forest sm:text-[2.1rem] lg:text-[2.6rem]"
            >
              <T>Find Our Store</T>
            </h2>
            <ul className="rv d2 mt-4 space-y-2.5 text-lg text-charcoal">
              <li className="flex items-start gap-2.5">
                <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-brass" />
                <span>
                  <T>{`${business.address.street}, ${business.address.locality}, ${business.address.country}`}</T>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone aria-hidden="true" className="mt-1 size-5 shrink-0 text-brass" />
                <a href={telHref} className="transition-colors hover:text-forest">
                  {business.phone.display}
                </a>
              </li>
            </ul>
            <div className="rv d3 mt-7 max-md:order-2 max-md:mt-3">
              <Button href={mapsHref} external variant="gold" arrow={false}>
                <T>Get Directions</T>
                <ArrowRight aria-hidden="true" className="ml-2 inline size-4" />
              </Button>
            </div>
          </div>
        </InView>
      </Container>
    </section>
  );
}
