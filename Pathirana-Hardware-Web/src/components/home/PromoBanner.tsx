import Image from "next/image";
import { images } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";

/** "Your Dream Project Starts Here!" — gold panel over the construction-site photograph. */
export function PromoBanner() {
  return (
    <section aria-labelledby="promo-title" className="bg-cream pb-16 lg:pb-20">
      <Container size="wide">
        <InView className="promo relative isolate overflow-hidden rounded-[var(--radius-panel)] bg-forest-900 shadow-[var(--shadow-panel)]">
          {/* Phones: the photo fills only the strip under the gold panel (so the
              building and excavator show, not just the steel in the foreground);
              from md it sits behind the angled panel as in the approved design. */}
          <div className="promo-image absolute inset-x-0 bottom-0 -z-10 h-56 overflow-hidden sm:h-64 md:inset-0 md:h-auto">
            <Image
              src={images.heroConstruction.src}
              alt={images.heroConstruction.alt}
              fill
              quality={90}
              sizes="(min-width: 1440px) 1360px, 100vw"
              className="object-cover object-[100%_50%] md:object-[75%_45%]"
            />
          </div>
          <div className="promo-panel relative w-full bg-gradient-to-br from-gold-soft via-[#e9b93a] to-brass px-6 py-10 sm:px-10 md:w-[58%] md:py-14 md:pr-24 md:[clip-path:polygon(0_0,100%_0,82%_100%,0_100%)] lg:w-[48%] lg:pl-14">
            <span aria-hidden="true" className="promo-line block h-0.5 w-14 bg-forest-900" />
            <h2
              id="promo-title"
              className="mt-4 font-display text-3xl leading-tight font-semibold text-charcoal sm:text-4xl"
            >
              Your Dream Project Starts Here!
            </h2>
            <p className="mt-3 max-w-sm text-[1.05rem] text-charcoal/85">
              Find materials for your next building project.
            </p>
            <div className="mt-7">
              <Button href="/products/" arrow="right" className="!bg-forest-900 hover:!bg-forest">
                Explore Our Products
              </Button>
            </div>
          </div>
          <div aria-hidden="true" className="h-56 sm:h-64 md:hidden" />
        </InView>
      </Container>
    </section>
  );
}
