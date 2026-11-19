import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleCheck, Info, Phone } from "lucide-react";
import { business, telHref, whatsappEnquiryHref } from "@/content/business";
import { getService, services } from "@/content/services";
import { createPageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Button, ButtonPair } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { ServiceVisual } from "@/components/home/ServiceVisual";
import { serviceIcons } from "@/components/services/ServiceIcon";
import { EnquirySteps } from "@/components/services/EnquirySteps";
import { EnquiryCta } from "@/components/contact/EnquiryCta";

type Props = { params: Promise<{ slug: string }> };

/** Only the six approved services exist; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = getService((await params).slug);
  if (!service) return {};
  return createPageMetadata({
    title: `${service.title} — Services`,
    description: `${service.description} Call or WhatsApp ${business.shortName}, Bangadeniya, on ${business.phone.display}.`,
    path: `/services/${service.id}/`,
  });
}

export default async function ServicePage({ params }: Props) {
  const service = getService((await params).slug);
  if (!service) notFound();

  const Icon = serviceIcons[service.icon];
  const enquiry = whatsappEnquiryHref(service.title);
  const others = services.filter((s) => s.id !== service.id);

  return (
    <>
      <PageHero
        crumb={service.title}
        parents={[{ label: "Services", href: "/services/" }]}
        eyebrow="Service"
        title={service.title}
        intro={<p>{service.description}</p>}
        media={
          <div
            data-three-hover
            className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-[1.75rem] bg-forest-900 ring-1 ring-gold-soft/25 lg:max-w-none"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_50%_100%,rgb(232_190_79/0.18),transparent_70%)]"
            />
            <ServiceVisual kind={service.kind} icon={service.icon} className="absolute inset-0 size-full" />
          </div>
        }
      >
        <Button
          href={enquiry}
          external
          variant="gold"
          icon={<WhatsAppIcon />}
          className="!bg-[#177a42] !text-white hover:!bg-[#11653a]"
        >
          Enquire on WhatsApp
        </Button>
        <Button href={telHref} variant="outlineLight" icon={<Phone />}>
          Call {business.phone.display}
        </Button>
      </PageHero>

      {/* About the service + what to ask */}
      <section aria-labelledby="service-about" className="bg-cream py-16 lg:py-24">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="reveal lg:col-span-6">
              <SectionHeading id="service-about" eyebrow="About this service" title="How it works" />
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-ink-muted">
                <p>{service.description}</p>
                <p>
                  <span className="font-semibold text-charcoal">How to ask: </span>
                  {service.howToAsk}
                </p>
              </div>
              <p className="mt-8 flex items-start gap-3 rounded-2xl border-l-4 border-brass bg-white px-5 py-4 text-sm leading-relaxed text-ink-muted shadow-[var(--shadow-card)]">
                <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brass-ink" />
                <span>
                  Specific terms — such as charges, timing, quantities or reservation periods — are not published
                  online. Please confirm them with the shop for your enquiry.
                </span>
              </p>
              <Link
                href="/services/"
                className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-forest hover:text-brass-ink"
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> Back to Services
              </Link>
            </div>

            <div className="reveal lg:col-span-6">
              <div className="on-dark relative isolate overflow-hidden rounded-[var(--radius-panel)] bg-forest p-7 text-white shadow-[var(--shadow-panel)] sm:p-10">
                <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-white/10 text-gold-soft ring-1 ring-gold-soft/30">
                  <Icon aria-hidden="true" strokeWidth={1.6} className="size-7" />
                </span>
                <h2 className="mt-6 font-display text-3xl font-medium">What you can enquire about</h2>
                <ul className="mt-6 space-y-4">
                  {service.enquireAbout.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-lg leading-snug text-cream">
                      <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gold-soft" />
                      {item}
                    </li>
                  ))}
                </ul>
                <ButtonPair className="mt-8 border-t border-white/15 pt-7">
                  <Button
                    href={enquiry}
                    external
                    variant="gold"
                    icon={<WhatsAppIcon />}
                    className="!bg-[#177a42] !text-white hover:!bg-[#11653a]"
                  >
                    Enquire on WhatsApp
                  </Button>
                  <Button href={telHref} variant="outlineLight" icon={<Phone />}>
                    Call Now
                  </Button>
                </ButtonPair>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Steps */}
      <section aria-labelledby="service-steps" className="bg-cream pb-16 lg:pb-24">
        <Container size="wide">
          <EnquirySteps
            id="service-steps"
            share={service.share}
            title={`Enquiring about ${service.shortTitle.toLowerCase()}`}
          />
        </Container>
      </section>

      {/* Other services */}
      <section aria-labelledby="other-services" className="bg-cream pb-16 lg:pb-24">
        <Container size="wide">
          <h2 id="other-services" className="reveal font-display text-2xl font-medium text-charcoal sm:text-3xl">
            Other services
          </h2>
          <ul className="reveal mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {others.map((s) => {
              const OtherIcon = serviceIcons[s.icon];
              return (
                <li key={s.id}>
                  <Link
                    href={`/services/${s.id}/`}
                    className="group flex h-full min-h-16 items-center gap-3 rounded-2xl border border-line/70 bg-white px-4 py-3 font-semibold text-forest transition-colors duration-200 hover:border-brass hover:bg-cream-deep"
                  >
                    <OtherIcon aria-hidden="true" strokeWidth={1.6} className="size-5 shrink-0 text-brass-ink" />
                    <span className="flex-1">{s.shortTitle}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <EnquiryCta
        id="service-cta-title"
        title={`Ask about ${service.shortTitle.toLowerCase()}`}
        intro="Call or WhatsApp the store. Specific terms are confirmed for each enquiry."
        whatsappHref={enquiry}
      />
    </>
  );
}
