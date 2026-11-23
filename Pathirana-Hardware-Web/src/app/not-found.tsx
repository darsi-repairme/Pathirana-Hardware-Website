import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { business, telHref } from "@/content/business";
import { mainNav } from "@/content/navigation";
import { Container } from "@/components/ui/Container";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/SectionHeading";
import { T, TRich, TRegion } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgb(232_190_79/0.14),transparent_60%)]"
      />
      <Container className="relative grid min-h-[65vh] items-center gap-12 py-20 lg:grid-cols-12">
        <div className="hero-enter lg:col-span-7">
          <Eyebrow>Error 404</Eyebrow>
          <h1 className="mt-5 font-display text-5xl leading-[1.04] text-charcoal sm:text-6xl">
            <TRich
              nodes={{
                page: (
                  <span className="text-forest italic">
                    <T>that page.</T>
                  </span>
                ),
              }}
            >
              {"We couldn’t find {page}"}
            </TRich>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
            <T vars={{ phone: business.phone.display }}>
              {
                "The page may have moved, or the address may be mistyped. Try one of the pages below, or call the store on {phone}."
              }
            </T>
          </p>
          <ButtonPair className="mt-9">
            <Button href="/" arrow="right">
              Back to home
            </Button>
            <Button href={telHref} variant="outline" icon={<Phone />}>
              <T vars={{ phone: business.phone.display }}>{"Call {phone}"}</T>
            </Button>
          </ButtonPair>
        </div>
        <TRegion as="nav" label="Site pages" className="lg:col-span-4 lg:col-start-9">
          <ul className="divide-y divide-line border-y border-line">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-14 items-center justify-between font-display text-xl text-charcoal transition-colors hover:text-forest"
                >
                  <T>{item.label}</T>
                  <span aria-hidden="true" className="text-brass">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </TRegion>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 font-display text-[9rem] leading-none text-transparent select-none [-webkit-text-stroke:1.5px_rgb(15_93_58/0.12)] sm:text-[14rem]"
        >
          404
        </p>
      </Container>
    </section>
  );
}
