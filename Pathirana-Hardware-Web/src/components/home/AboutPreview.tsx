import Image from "next/image";
import { images } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { BlueprintArt } from "./BlueprintArt";
import { T } from "@/i18n/I18nProvider";

/**
 * Homepage About preview — three areas: the shop-front photograph, a short
 * introduction with Learn More, and the animated blueprint illustration.
 */
export function AboutPreview() {
  return (
    <section aria-labelledby="about-preview-title" className="about-blend pt-12 pb-6 sm:pt-16 sm:pb-8 lg:pt-20 lg:pb-8">
      <Container size="wide">
        <div className="grid items-center gap-8 sm:gap-10 xl:grid-cols-12 xl:gap-10">
          <InView className="about-reveal grid items-center gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12 xl:col-span-9">
            <div className="about-image group relative aspect-[2/1] overflow-hidden rounded-[1.5rem] bg-cream-deep shadow-[var(--shadow-lift)]">
              <Image
                src={images.storefront.src}
                alt={images.storefront.alt}
                fill
                quality={90}
                sizes="(min-width: 1440px) 640px, (min-width: 1024px) 42vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover object-[50%_45%] transition-transform duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.04] motion-reduce:transition-none"
              />
            </div>

            <div className="about-text">
              <span aria-hidden="true" className="about-line block h-0.5 w-14 bg-brass" />
              <h2
                id="about-preview-title"
                className="mt-5 font-display text-3xl leading-tight font-semibold text-forest sm:text-[2.3rem]"
              >
                <T>About Pathirana Hardware</T>
              </h2>
              {/* Justified (CEO review #06) with hyphenation so lines stay even without wide word gaps. */}
              <p className="mt-4 max-w-md text-justify text-[1.05rem] leading-relaxed hyphens-auto text-ink-muted">
                <T>
                  Established on 16 April 1997, Pathirana Hardware supplies hardware and building materials for homes
                  and construction projects — from cement, TOR bars, box bars and plywood to doors, windows, bathroom
                  sets and gas cylinders. The business is led today by owner Oshada Warshan Pathirana.
                </T>
              </p>
              <p className="mt-3 font-display text-lg text-brass-ink italic">
                “<T>Shop smarter, save bigger!</T>”
              </p>
              <div className="mt-7">
                <Button href="/about/" variant="gold" arrow="right">
                  Learn More
                </Button>
              </div>
            </div>
          </InView>

          <div className="mx-auto w-full max-w-xs xl:col-span-3 xl:max-w-none xl:border-l xl:border-line xl:pl-8">
            <BlueprintArt />
          </div>
        </div>
      </Container>
    </section>
  );
}
