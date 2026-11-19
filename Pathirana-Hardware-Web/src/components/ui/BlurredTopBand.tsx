import Image from "next/image";
import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";
import { Container } from "./Container";

type SiteImage = { src: string; alt: string; width: number; height: number };

/**
 * Heading band at the top of an inner page's first section (Services, About,
 * Contact): the page heading in front of a softly blurred hardware photo with
 * a layered forest-green veil for readability. Background only — no grid
 * lines or graphics. Compact on every screen size.
 */
export function BlurredTopBand({
  id,
  image,
  position = "object-center",
  crumb,
  title,
  intro,
}: {
  /** id of the h1 (the parent section is labelled by it). */
  id: string;
  image: SiteImage;
  /** object-position utility, e.g. "object-[50%_30%]". */
  position?: string;
  crumb: string;
  title: ReactNode;
  intro?: ReactNode;
}) {
  return (
    <div className="on-dark relative isolate overflow-hidden bg-forest-900 text-white">
      {/* Blurred photo (cover, centred); scaled up slightly so the blur never
          shows soft edges. Decorative. */}
      <Image
        src={image.src}
        alt=""
        fill
        preload
        quality={60}
        sizes="(min-width: 1024px) 60vw, 100vw"
        className={`-z-20 scale-110 object-cover blur-[6px] ${position}`}
      />
      {/* Layered veil: an even green wash plus a deeper centre for the text. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-forest-900/70" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_55%,rgb(7_46_29/0.55),transparent_70%)]"
      />
      <Container size="wide" className="py-12 text-center sm:py-14 lg:py-16">
        <div className="hero-enter mx-auto max-w-2xl">
          <Breadcrumbs current={crumb} className="flex justify-center [&_ol]:justify-center" />
          <h1
            id={id}
            className="mt-5 font-display text-[clamp(2.1rem,7vw,3.4rem)] leading-tight font-semibold text-cream"
          >
            {title}
          </h1>
          <span
            aria-hidden="true"
            className="mx-auto mt-4 block h-0.5 w-16 rounded-full bg-gradient-to-r from-brass to-gold-soft"
          />
          {intro ? (
            <div className="mx-auto mt-4 max-w-xl text-[clamp(1rem,2.6vw,1.15rem)] leading-relaxed text-sage">
              {intro}
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
