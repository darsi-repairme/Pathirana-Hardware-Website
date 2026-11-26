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
      <Container className="relative grid items-center gap-10 py-14 sm:py-16 lg:min-h-[62vh] lg:grid-cols-12 lg:gap-12 lg:py-20">
        {/* Phones / tablets: one centred column. Desktop: text left, site pages right. */}
        <div className="hero-enter mx-auto max-w-2xl text-center lg:col-span-7 lg:mx-0 lg:text-left">
          <p className="font-display leading-none font-semibold tracking-tight text-forest lining-nums">
            <span aria-hidden="true" className="block text-[clamp(6rem,30vw,9rem)] sm:text-[10rem] lg:text-[11.5rem]">
              404
            </span>
            <span className="sr-only">
              <T>Error 404</T>
            </span>
          </p>
          <div className="mt-4 flex justify-center lg:justify-start">
            <Eyebrow>Page not found</Eyebrow>
          </div>
          <h1 className="mt-4 font-display text-4xl leading-[1.08] text-balance text-charcoal sm:text-5xl">
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
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-ink-muted sm:text-lg lg:mx-0">
            <T vars={{ phone: business.phone.display }}>
              {
                "The page may have moved, or the address may be mistyped. Try one of the pages below, or call the store on {phone}."
              }
            </T>
          </p>
          <ButtonPair className="mx-auto mt-8 max-w-xl lg:mx-0">
            <Button href="/" arrow="right">
              Back to home
            </Button>
            <Button href={telHref} variant="outline" icon={<Phone />}>
              <T vars={{ phone: business.phone.display }}>{"Call {phone}"}</T>
            </Button>
          </ButtonPair>
        </div>
        <TRegion
          as="nav"
          label="Site pages"
          className="mx-auto w-full max-w-2xl lg:col-span-4 lg:col-start-9 lg:max-w-none"
        >
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
      </Container>
    </section>
  );
}
