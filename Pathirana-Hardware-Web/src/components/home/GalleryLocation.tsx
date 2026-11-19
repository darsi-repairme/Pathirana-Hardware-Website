import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import { business, mapsHref, telHref } from "@/content/business";
import { testimonials } from "@/content/testimonials";
import { images } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { LocationVisual } from "./LocationVisual";
import { ConstructionSkyline } from "./ConstructionSkyline";
import { Testimonials } from "./Testimonials";

/**
 * Home gallery tiles — real store photographs. Spans/heights per breakpoint:
 * phones = a swipeable, staggered strip; sm–md = 6-column collage;
 * lg = 12-column editorial collage (one tall feature image + four).
 */
const tiles = [
  {
    image: images.aisleTools,
    label: "Tools & paint aisle",
    tile: "max-sm:h-72 sm:col-span-4 sm:row-span-2 lg:col-span-5 lg:row-span-2",
    position: "object-[30%_50%]",
  },
  {
    image: images.aisleMaterials,
    label: "Pipes, boards & blocks",
    tile: "max-sm:mt-8 max-sm:h-60 sm:col-span-2 lg:col-span-4",
    position: "object-center",
  },
  {
    image: images.plumbing,
    label: "Plumbing fittings",
    tile: "max-sm:h-72 sm:col-span-2 lg:col-span-3",
    position: "object-center",
  },
  {
    image: images.toolsPaint,
    label: "Paint & power tools",
    tile: "max-sm:mt-8 max-sm:h-60 sm:col-span-3 lg:col-span-3",
    position: "object-center",
  },
  {
    image: images.shopFront,
    label: "Our shop front",
    tile: "max-sm:h-72 sm:col-span-3 lg:col-span-4",
    position: "object-[50%_40%]",
  },
] as const;

const tileDelays = ["d1", "d2", "d3", "d4", "d5"];

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
                  Our Gallery
                </h2>
                <p className="rv d1 mt-2 text-ink-muted">A look inside the store.</p>
              </div>
              <div className="rv d2">
                <Button href="/gallery/" variant="outline" arrow="right">
                  View Gallery
                </Button>
              </div>
            </div>

            {/* Phones: swipe sideways (snap); larger screens: collage. */}
            <ul className="gallery-strip -mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:auto-rows-[11rem] sm:grid-cols-6 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:mt-10 lg:auto-rows-[15rem] lg:grid-cols-12">
              {tiles.map((t, i) => (
                <li
                  key={t.label}
                  className={`rv-img ${tileDelays[i]} w-[72%] shrink-0 snap-start min-[480px]:w-[46%] sm:w-auto ${t.tile}`}
                >
                  <Link
                    href="/gallery/"
                    className="zoom-img group relative block h-full overflow-hidden rounded-[1.25rem] bg-cream-deep shadow-[var(--shadow-card)]"
                  >
                    <Image
                      src={t.image.src}
                      alt={t.image.alt}
                      fill
                      quality={85}
                      sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 72vw"
                      className={`object-cover ${t.position}`}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-forest-900/70 to-transparent"
                    />
                    <span className="absolute bottom-3 left-3 text-sm font-semibold text-white">
                      {t.label}
                      <span className="sr-only"> — open the gallery</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </InView>
        </Container>
      </section>

      <Testimonials items={testimonials} />
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
      <ConstructionSkyline className="skyline-fade absolute inset-x-0 bottom-0 -z-10 h-24 w-full text-brass/40 sm:h-28 lg:aspect-[1440/150] lg:h-auto lg:text-brass/55" />

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
              Find Our Store
            </h2>
            <ul className="rv d2 mt-4 space-y-2.5 text-lg text-charcoal">
              <li className="flex items-start gap-2.5">
                <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-brass" />
                <span>
                  {business.address.street}, {business.address.locality}, {business.address.country}
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
                Get Directions
                <ArrowRight aria-hidden="true" className="ml-2 inline size-4" />
              </Button>
            </div>
          </div>
        </InView>
      </Container>
    </section>
  );
}
