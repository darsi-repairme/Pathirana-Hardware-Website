import type { Metadata } from "next";
import { BrickWall, CalendarDays, HardHat, MapPin, Phone } from "lucide-react";
import { business, mapsHref, telHref } from "@/content/business";
import { images } from "@/lib/images";
import { createPageMetadata } from "@/lib/metadata";
import { BlurredTopBand } from "@/components/ui/BlurredTopBand";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ShopPhoto } from "@/components/about/ShopPhoto";
import { DirectionsArt } from "@/components/about/DirectionsArt";
import { CategoryRowList } from "@/components/products/CategoryLinks";
import { ConstructionSkyline } from "@/components/home/ConstructionSkyline";
import { T, TRegion, TRich } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "About Us",
    description: `${business.shortName} has supplied hardware and building materials from Pallama Road, Bangadeniya, Sri Lanka, since ${business.foundedDate}. Learn about the business, our products and our services.`,
    path: "/about/",
  }),
};

/** Only confirmed facts (no customer counts, awards or milestones). */
const since = [
  { icon: CalendarDays, label: "Established", value: business.foundedDate },
  { icon: BrickWall, label: "What we supply", value: "Hardware and building materials" },
  { icon: HardHat, label: "Who we serve", value: "Home and construction projects" },
] as const;

/**
 * About (approved reference): Our Story (blurred heading band (text · shop photo · Since 1997)
 * · the tagline quote · product categories · Our Location band.
 */
export default function AboutPage() {
  return (
    <>
      {/* Our Story — text · shop photo · Since 1997 */}
      <section aria-labelledby="about-title">
        <BlurredTopBand
          id="about-title"
          image={images.heroMaterials}
          position="object-[50%_55%]"
          crumb="About Us"
          title="About Us"
          intro={
            <p>
              <T>A trusted hardware partner for building and construction needs since 1997.</T>
            </p>
          }
        />
        <div className="bg-cream pt-12 pb-16 lg:pt-16 lg:pb-24">
          <Container size="wide">
            <div className="grid items-center gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.9fr)] xl:gap-x-14">
              <div className="reveal">
                <h2
                  id="our-story"
                  className="font-display text-[clamp(1.75rem,5vw,2.25rem)] leading-tight font-semibold text-forest"
                >
                  <T>Our Story</T>
                </h2>
                <span
                  aria-hidden="true"
                  className="mt-3 mb-5 block h-0.5 w-14 bg-gradient-to-r from-brass to-gold-soft"
                />
                <div className="space-y-4 text-justify text-[1.05rem] leading-relaxed hyphens-auto text-ink-muted">
                  <p>
                    <T
                      vars={{
                        name: business.shortName,
                        date: business.foundedDate,
                        street: business.address.street,
                        locality: business.address.locality,
                      }}
                    >
                      {
                        "{name} was established on {date} on {street}, {locality}. The business supplies hardware and building materials for homes, renovations and construction projects."
                      }
                    </T>
                  </p>
                  <p>
                    <TRich
                      vars={{ owner: business.owner }}
                      nodes={{
                        phone: (
                          <a
                            href={telHref}
                            className="font-semibold whitespace-nowrap text-forest hover:text-brass-ink"
                          >
                            {business.phone.display}
                          </a>
                        ),
                      }}
                    >
                      {
                        "The store is led by owner {owner}. Visit us, or call or WhatsApp {phone} to ask about products, prices and availability."
                      }
                    </TRich>
                  </p>
                </div>
              </div>

              <div className="reveal mx-auto w-full max-w-sm pb-5 md:max-w-none">
                <ShopPhoto sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw" />
              </div>

              {/* Since 1997 */}
              <div className="reveal on-dark relative isolate overflow-hidden rounded-[var(--radius-panel)] bg-forest-900 px-7 py-9 text-white shadow-[var(--shadow-panel)] md:col-span-2 lg:col-span-1">
                <div
                  aria-hidden="true"
                  className="absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.2),transparent_65%)]"
                />
                <h2 className="text-center lg:text-left">
                  <span className="block text-xs font-semibold tracking-[0.32em] text-gold-soft uppercase">
                    <T>Since</T>
                  </span>
                  <span className="mt-1 block bg-gradient-to-r from-gold-soft to-brass bg-clip-text font-display text-[4.25rem] leading-none font-semibold text-transparent">
                    1997
                  </span>
                </h2>
                <span
                  aria-hidden="true"
                  className="mx-auto mt-5 block h-px w-full bg-gradient-to-r from-transparent via-gold-soft/60 to-transparent lg:mx-0"
                />
                <dl className="mt-1 grid md:grid-cols-3 lg:grid-cols-1">
                  {since.map(({ icon: Icon, label, value }) => (
                    // Valid <dl>: one plain <div> per dt/dd pair; the icon sits inside the <dt>,
                    // positioned in the same place as before (left of the text, 0.875rem gap).
                    <div
                      key={label}
                      className="relative min-w-0 border-b border-white/12 py-4 pl-[2.375rem] last:border-b-0 md:border-b-0 lg:border-b"
                    >
                      <dt className="text-[0.7rem] font-semibold tracking-[0.18em] text-gold-soft/85 uppercase">
                        <Icon
                          aria-hidden="true"
                          strokeWidth={1.4}
                          className="absolute top-4 left-0 mt-0.5 size-6 text-gold-soft"
                        />
                        <T>{label}</T>
                      </dt>
                      <dd className="mt-0.5 font-semibold text-white">
                        <T>{value}</T>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Container>
        </div>
      </section>

      {/* The official tagline */}
      <TRegion as="section" label="Our tagline" className="bg-cream-deep/60 py-16 lg:py-20">
        <Container>
          <figure className="reveal mx-auto max-w-3xl text-center">
            <span
              aria-hidden="true"
              className="block font-display text-[5.5rem] leading-[0.6] text-brass/70 select-none sm:text-[7rem]"
            >
              &ldquo;
            </span>
            <div className="mt-2 flex items-center justify-center gap-4 sm:gap-6">
              <span
                aria-hidden="true"
                className="h-px w-6 shrink-0 bg-gradient-to-r from-transparent to-brass min-[400px]:w-10 sm:w-20"
              />
              <blockquote className="min-w-0">
                <p className="font-display text-[clamp(1.5rem,6vw,3.1rem)] leading-tight font-semibold text-forest italic">
                  <T>{business.tagline}</T>
                </p>
              </blockquote>
              <span
                aria-hidden="true"
                className="h-px w-6 shrink-0 bg-gradient-to-l from-transparent to-brass min-[400px]:w-10 sm:w-20"
              />
            </div>
            <figcaption className="mt-5 text-sm font-semibold tracking-[0.2em] text-brass-ink uppercase">
              {business.shortName}
            </figcaption>
          </figure>
        </Container>
      </TRegion>

      {/* Product categories — two-column rows (icon · name · arrow · hairline). */}
      <section aria-labelledby="about-categories" className="bg-cream py-16 lg:py-20">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="reveal lg:col-span-4">
              <span aria-hidden="true" className="block h-0.5 w-12 bg-brass" />
              <h2
                id="about-categories"
                className="mt-4 font-display text-[clamp(1.75rem,5vw,2.4rem)] leading-tight font-semibold text-forest"
              >
                <T>Our Product Categories</T>
              </h2>
              <p className="mt-3 text-ink-muted">
                <T>Hardware and building materials for homes and projects.</T>
              </p>
              <div className="mt-6">
                <Button href="/products/" variant="outline" arrow="right">
                  View all products
                </Button>
              </div>
            </div>
            <CategoryRowList className="reveal grid gap-x-10 sm:grid-cols-2 lg:col-span-8" />
          </div>
        </Container>
      </section>

      {/* Our Location — dark-green band with a "find our store" directions illustration (its own
          artwork, not the Home page's delivery truck) and the gold skyline. */}
      <section
        id="where-we-are"
        aria-labelledby="where-we-are-title"
        className="on-dark relative isolate scroll-mt-28 overflow-hidden bg-forest-900 pt-14 pb-28 text-white sm:pb-32 lg:pt-16 lg:pb-[clamp(8rem,11vw,10.5rem)]"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 right-[-12%] -z-10 size-[min(44rem,110vw)] rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.12),transparent_62%)]"
        />
        <ConstructionSkyline className="skyline-fade absolute inset-x-0 bottom-0 -z-10 aspect-[1440/150] h-auto w-full text-gold-soft/35 lg:text-gold-soft/45" />
        <Container size="wide">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-14">
            <div className="reveal">
              <span aria-hidden="true" className="block h-0.5 w-12 bg-gold-soft" />
              <h2 id="where-we-are-title" className="mt-4 font-display text-[clamp(1.9rem,5vw,2.6rem)] font-semibold">
                <T>Our Location</T>
              </h2>
              <address className="mt-5 flex items-start gap-3 text-lg leading-relaxed text-sage not-italic">
                <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0 text-gold-soft" />
                <span>
                  <span className="block font-semibold text-white">{business.shortName}</span>
                  <T>{`${business.address.street}, ${business.address.locality}, ${business.address.country}`}</T>
                </span>
              </address>
              <p className="mt-3 flex items-center gap-3 text-lg text-sage">
                <Phone aria-hidden="true" className="size-5 shrink-0 text-gold-soft" />
                <a href={telHref} className="transition-colors hover:text-gold-soft">
                  {business.phone.display}
                </a>
              </p>
              <div className="mt-7">
                <Button href={mapsHref} external variant="gold" icon={<MapPin />} arrow="external">
                  Get Directions
                </Button>
              </div>
            </div>
            <div className="reveal mx-auto w-full max-w-[24rem] lg:max-w-[28rem]">
              <DirectionsArt label={business.shortName} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
