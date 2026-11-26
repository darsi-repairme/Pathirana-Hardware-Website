import Image from "next/image";
import type { ReactNode } from "react";
import { tx } from "@/i18n/tx";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { Container } from "./Container";

type SiteImage = { src: string; alt: string; width: number; height: number };

type Props = {
  id: string;
  image: SiteImage;
  /**
   * Sets --hero-tone to the artwork's own left-edge green (a literal class such
   * as "[--hero-tone:#012c19]") so the solid areas match it without a seam.
   */
  tone: string;
  /** object-position utilities, e.g. "object-[88%_100%] lg:object-[100%_100%]". */
  position: string;
  crumb: string;
  parents?: readonly Crumb[];
  title: ReactNode;
  intro: ReactNode;
  /**
   * true: the artwork already ends in the red/gold curve over cream (Services,
   * About, Contact). false: a matching curve is drawn here (Gallery), and the
   * left of the image gets a stronger green veil because it has no green area.
   */
  builtInCurve?: boolean;
  /** Small label on the image, e.g. "Illustration". */
  note?: string;
  children?: ReactNode;
};

/**
 * Inner-page hero over the supplied wide artworks (forest green on the left,
 * the subject on the right, a red and gold curve into cream along the bottom).
 *
 *  • lg+: the artwork fills the band, anchored bottom-right so the subject and
 *    the curve stay in view; the text sits on the green at the left, above the curve.
 *  • Below lg (phones, tablets, landscape phones): stacked — the text on the
 *    artwork's own green, then the artwork cropped to its subject, faded in at
 *    the top so there is no seam.
 *  • The artwork's cream fades into the page cream at the very bottom.
 * The artwork is decorative (alt=""); the heading carries the meaning.
 */
export function ImageHero({
  id,
  image,
  tone,
  position,
  crumb,
  parents = [],
  title,
  intro,
  builtInCurve = true,
  note,
  children,
}: Props) {
  return (
    <section
      aria-labelledby={id}
      className={`on-dark relative isolate overflow-hidden bg-[var(--hero-tone)] text-white lg:flex lg:h-[clamp(30rem,43.75vw,46rem)] lg:items-center ${tone}`}
    >
      <Container size="wide" className="relative z-10 pt-7 pb-6 sm:pt-9 lg:w-full lg:pt-4 lg:pb-[9.5%]">
        <div className="hero-enter max-w-xl lg:max-w-[min(36rem,44%)]">
          <Breadcrumbs current={crumb} parents={parents} className="mb-5 lg:mb-6" />
          <h1
            id={id}
            className="font-display text-[clamp(2.05rem,7.4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.01em] lg:text-[clamp(2.4rem,3.4vw,3.6rem)]"
          >
            {tx(title)}
          </h1>
          <span
            aria-hidden="true"
            className="mt-5 block h-0.5 w-20 rounded-full bg-gradient-to-r from-brass to-gold-soft"
          />
          <div className="mt-5 max-w-lg text-[clamp(1rem,2.4vw,1.15rem)] leading-relaxed text-sage">{tx(intro)}</div>
          {children ? <div className="mt-7">{children}</div> : null}
        </div>
      </Container>

      <div className="relative aspect-[4/3] min-[480px]:aspect-[16/10] sm:aspect-[2/1] lg:absolute lg:inset-0 lg:-z-10 lg:aspect-auto">
        <Image src={image.src} alt="" fill preload quality={85} sizes="100vw" className={`object-cover ${position}`} />
        {/* Below lg: fade the artwork in from the green text area above. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[var(--hero-tone)] to-transparent lg:hidden"
        />
        {/* lg: a veil behind the text, stopping above the curve. */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 hidden lg:block ${
            builtInCurve
              ? "bg-[linear-gradient(to_right,var(--hero-tone)_0%,color-mix(in_srgb,var(--hero-tone)_70%,transparent)_34%,transparent_52%)] [mask-image:linear-gradient(to_bottom,#000_62%,transparent_76%)]"
              : "bg-[linear-gradient(to_right,var(--hero-tone)_0%,color-mix(in_srgb,var(--hero-tone)_88%,transparent)_36%,transparent_68%)]"
          }`}
        />
        {builtInCurve ? null : (
          // Matching red and gold curve into cream (the other heroes have it built in).
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-0 h-[16%] w-full"
          >
            <path d="M0 70C360 120 900 40 1440 64V120H0Z" className="fill-cream" />
            <path
              d="M0 70C360 120 900 40 1440 64"
              fill="none"
              stroke="#E8BE4F"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M0 58C330 104 860 30 1440 52"
              fill="none"
              stroke="#B3121A"
              strokeOpacity="0.85"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
        {/* The artwork's cream eases into the page cream (no colour step below). */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[9%] bg-gradient-to-b from-transparent to-cream"
        />
        {note ? (
          <span className="absolute top-3 right-3 z-10 rounded-full bg-forest-900/80 px-2.5 py-1 text-xs font-medium text-cream/90 sm:right-5 lg:top-5">
            {tx(note)}
          </span>
        ) : null}
      </div>
    </section>
  );
}
