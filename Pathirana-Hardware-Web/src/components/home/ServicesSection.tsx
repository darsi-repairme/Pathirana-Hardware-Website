import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { HomeEyebrow } from "./HomeEyebrow";
import { ServicesRing } from "./ServicesRing";

/**
 * Home Services: all six client-approved services on the 360° ring (each
 * with its 3D object), below the cream-to-green curve.
 */
export function ServicesSection() {
  return (
    <section aria-labelledby="services-title" className="on-dark relative bg-forest-900 text-white">
      {/* Tinted-cream-to-green curve with gold and red lines. The lines are
          revealed left-to-right with a clip (not a stroke dash: with a stretched
          viewBox and non-scaling strokes Chrome maps dashes in screen space, so
          the "finished" line stopped short). Both lines run to the right edge;
          the red one fades in from transparent instead of starting bluntly. */}
      <InView className="swoosh-draw pointer-events-none relative -mb-px bg-about-tint" threshold={0.5}>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          className="block h-10 w-full sm:h-16 lg:h-20"
        >
          <path d="M0 80V80C620 80 1080 60 1440 0V80Z" className="fill-forest-900" />
        </svg>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          className="swoosh-lines absolute inset-0 block h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="services-red-fade" gradientUnits="userSpaceOnUse" x1="420" y1="0" x2="900" y2="0">
              <stop offset="0" stopColor="#E3101A" stopOpacity="0" />
              <stop offset="1" stopColor="#E3101A" />
            </linearGradient>
          </defs>
          <path
            d="M0 79C620 79 1080 59 1440 -1"
            fill="none"
            stroke="#E8BE4F"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M420 76C900 71 1180 49 1440 11"
            fill="none"
            stroke="url(#services-red-fade)"
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </InView>

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
              Practical Support for Your Building Needs
            </h2>
          </div>

          <div className="rv d2 mt-8 lg:mt-10">
            <ServicesRing />
          </div>
        </InView>
      </Container>
    </section>
  );
}
