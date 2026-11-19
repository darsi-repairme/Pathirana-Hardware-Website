import type { ReactNode } from "react";
import { Breadcrumbs } from "./Breadcrumbs";
import { Container } from "./Container";
import { Eyebrow } from "./SectionHeading";

type Props = {
  eyebrow: string;
  title: ReactNode;
  intro: ReactNode;
  /** Current page label for the breadcrumb. */
  crumb: string;
  /** Parent pages between Home and the current page (detail pages). */
  parents?: readonly { label: string; href: string }[];
  /** Optional visual (image or 3D) shown beside the text on large screens, below it on small ones. */
  media?: ReactNode;
  /** Call-to-action buttons (use light/gold variants — the panel is dark green). */
  children?: ReactNode;
};

/** Premium green hero panel shared by the inner pages. */
export function PageHero({ eyebrow, title, intro, crumb, parents = [], media, children }: Props) {
  return (
    <section className="bg-cream pt-4 sm:pt-6">
      <Container size="wide">
        <div className="on-dark relative isolate overflow-clip rounded-[var(--radius-panel)] bg-forest text-white shadow-[var(--shadow-panel)]">
          <div
            aria-hidden="true"
            className="absolute -top-40 -right-32 -z-10 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.22),transparent_65%)]"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 400 300"
            preserveAspectRatio="none"
            className="absolute right-0 bottom-0 -z-10 h-full w-1/2 opacity-90 max-md:hidden"
          >
            <path d="M400 40 C 300 120, 220 220, 120 300 L 400 300 Z" fill="#072e1d" fillOpacity="0.55" />
            <path d="M400 70 C 300 150, 230 240, 150 300" fill="none" stroke="#b8860b" strokeWidth="2.5" />
          </svg>

          <div className="px-6 pt-8 pb-12 sm:px-12 sm:pt-10 sm:pb-16 lg:px-16 lg:pb-20 land:px-10 land:pt-6 land:pb-10">
            <Breadcrumbs current={crumb} parents={parents} className="mb-10 land:mb-5" />

            <div
              className={media ? "grid items-center gap-10 lg:grid-cols-12 lg:gap-12 land:grid-cols-12 land:gap-8" : ""}
            >
              <div className={`hero-enter max-w-3xl ${media ? "lg:col-span-7 land:col-span-7" : ""}`}>
                <Eyebrow tone="dark">{eyebrow}</Eyebrow>
                <h1 className="mt-5 font-display text-[2.5rem] leading-[1.06] font-medium tracking-[-0.01em] text-white sm:text-6xl lg:text-[4.25rem] land:mt-3 land:text-[clamp(2.1rem,5vw,2.75rem)]">
                  {title}
                </h1>
                <div
                  aria-hidden="true"
                  className="mt-7 h-0.5 w-24 rounded-full bg-gradient-to-r from-brass to-gold-soft land:mt-4"
                />
                <div className="mt-7 max-w-2xl text-lg leading-relaxed text-sage land:mt-4 land:text-base">{intro}</div>
                {children ? <div className="mt-9 flex flex-wrap gap-3 land:mt-6">{children}</div> : null}
              </div>
              {media ? <div className="hero-enter min-w-0 lg:col-span-5 land:col-span-5">{media}</div> : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
