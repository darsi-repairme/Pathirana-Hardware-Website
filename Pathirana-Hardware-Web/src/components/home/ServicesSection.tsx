import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { HomeEyebrow } from "./HomeEyebrow";
import { ServicesRing } from "./ServicesRing";
import { SeeMoreServices } from "@/components/services/SeeMoreServices";
import { T } from "@/i18n/I18nProvider";

/**
 * Home Services: all six client-approved services on the 360° ring (each
 * with its 3D object), below the cream-to-green curve.
 */
export function ServicesSection() {
  return (
    <section aria-labelledby="services-title" className="on-dark relative text-white">
      {/* Tinted-cream-to-green curve (a plain transition: the gold and red lines that used to run
          along it were removed at the client's request). The strip's tint ends 1px above its bottom (green there) and the
          section has no background of its own, so the strip's top edge sits on the matching tint of
          the About section and its bottom edge on the green below: no anti-aliased hairlines at
          fractional pixel positions (the two faint lines under the "Build Better…" illustration). */}
      <div
        className="pointer-events-none relative z-[1] bg-[linear-gradient(var(--color-about-tint)_calc(100%-1px),var(--color-forest-900)_0)]"
        data-services-curve
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          shapeRendering="geometricPrecision"
          className="block h-10 w-full sm:h-16 lg:h-20"
        >
          <path d="M0 80V80C620 80 1080 60 1440 0V80Z" className="fill-forest-900" />
        </svg>
      </div>

      {/* The green starts 1px UNDER the curve (curve paints above), so the curve's bottom edge blends. */}
      <div className="relative -mt-px bg-forest-900">
        <Container size="wide" className="pt-8 pb-16 lg:pb-20">
          <InView className="reveal-group">
            <div className="text-center">
              <div className="rv">
                <HomeEyebrow tone="dark">Our services</HomeEyebrow>
              </div>
              <h2
                id="services-title"
                className="rv d1 mt-4 font-display text-3xl leading-tight font-semibold sm:text-4xl lg:text-[2.6rem]"
              >
                <T>Practical Support for Your Building Needs</T>
              </h2>
            </div>

            <div className="rv d2 mt-8 lg:mt-10">
              <ServicesRing />
            </div>
            <SeeMoreServices variant="gold" className="rv d3 mt-8 lg:mt-10" />
          </InView>
        </Container>
      </div>
    </section>
  );
}
