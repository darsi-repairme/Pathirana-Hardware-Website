"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CircleCheck, CloudOff, Info, Phone } from "lucide-react";
import { business, telHref } from "@/content/business";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";
import { Button, ButtonPair } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ServiceVisual } from "@/components/home/ServiceVisual";
import { serviceIcons } from "@/components/services/ServiceIcon";
import { EnquirySteps } from "@/components/services/EnquirySteps";
import { EnquiryCta } from "@/components/contact/EnquiryCta";
import { WhatsAppSubjectButton } from "@/components/contact/WhatsAppSubjectButton";
import { T, useT } from "@/i18n/I18nProvider";
import { serviceHref, useServiceText, useSiteServices, type SiteService } from "@/lib/live-services";

/**
 * A pre-built service page (/services/<slug>/, static export). ALL of its content comes from the
 * live database: the page shows a loading state, then the published service's own text. A service
 * staff have hidden (or one that was never published) shows "Service not available"; when the API
 * is unreachable, "Temporarily unavailable". Nothing bundled with the site is shown.
 */
export function LiveServicePage({ slug }: { slug: string }) {
  const { services, status } = useSiteServices();
  const service = services.find((s) => s.id === slug);
  if (status === "loading") return <ServiceLoading />;
  if (status === "error") return <ServiceUnavailable />;
  if (!service) return <ServiceHidden />;
  return <ServiceContent service={service} others={services.filter((s) => s.id !== slug)} />;
}

function ServiceContent({ service, others }: { service: SiteService; others: readonly SiteService[] }) {
  const text = useServiceText();
  const st = text(service);
  const Icon = serviceIcons[service.icon];
  // English title for the WhatsApp subject (the message is written in English).
  const subject = service.title;
  const name = st.shortTitle.toLowerCase();

  return (
    <div data-service-state="live">
      <PageHero
        crumb={st.title}
        parents={[{ label: "Services", href: "/services/" }]}
        eyebrow="Service"
        title={<>{st.title}</>}
        intro={<p>{st.description}</p>}
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
        <WhatsAppSubjectButton subject={subject} variant="gold" />
        <Button href={telHref} variant="outlineLight" icon={<Phone />}>
          <T vars={{ phone: business.phone.display }}>{"Call {phone}"}</T>
        </Button>
      </PageHero>

      {/* About the service + what to ask */}
      <section aria-labelledby="service-about" className="bg-cream py-16 lg:py-24">
        <Container size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="reveal lg:col-span-6">
              <SectionHeading id="service-about" eyebrow="About this service" title="How it works" />
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-ink-muted">
                <p className="whitespace-pre-line">{st.description}</p>
                {st.howToAsk ? (
                  <p>
                    <span className="font-semibold text-charcoal">
                      <T>How to ask:</T>{" "}
                    </span>
                    {st.howToAsk}
                  </p>
                ) : null}
              </div>
              <p className="mt-8 flex items-start gap-3 rounded-2xl border-l-4 border-brass bg-white px-5 py-4 text-sm leading-relaxed text-ink-muted shadow-[var(--shadow-card)]">
                <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brass-ink" />
                <span>
                  <T>
                    Specific terms — such as charges, timing, quantities or reservation periods — are not published
                    online. Please confirm them with the shop for your enquiry.
                  </T>
                </span>
              </p>
              <Link
                href="/services/"
                className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-forest hover:text-brass-ink"
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> <T>Back to Services</T>
              </Link>
            </div>

            <div className="reveal lg:col-span-6">
              <div className="on-dark relative isolate overflow-hidden rounded-[var(--radius-panel)] bg-forest p-7 text-white shadow-[var(--shadow-panel)] sm:p-10">
                <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-white/10 text-gold-soft ring-1 ring-gold-soft/30">
                  <Icon aria-hidden="true" strokeWidth={1.6} className="size-7" />
                </span>
                {st.enquireAbout.length ? (
                  <>
                    <h2 className="mt-6 font-display text-3xl font-medium">
                      <T>What you can enquire about</T>
                    </h2>
                    <ul className="mt-6 space-y-4">
                      {st.enquireAbout.map((item) => (
                        <li key={item} className="flex items-start gap-3 text-lg leading-snug text-cream">
                          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gold-soft" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <h2 className="mt-6 font-display text-3xl font-medium">{st.title}</h2>
                )}
                <ButtonPair className="mt-8 border-t border-white/15 pt-7">
                  <WhatsAppSubjectButton subject={subject} variant="gold" />
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
            share={st.share || undefined}
            title="Enquiring about {name}"
            titleVars={{ name }}
          />
        </Container>
      </section>

      {/* Other services: the other PUBLISHED services only */}
      {others.length ? (
        <section aria-labelledby="other-services" className="bg-cream pb-16 lg:pb-24">
          <Container size="wide">
            <h2 id="other-services" className="reveal font-display text-2xl font-medium text-charcoal sm:text-3xl">
              <T>Other services</T>
            </h2>
            <ul className="reveal mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {others.map((s) => {
                const OtherIcon = serviceIcons[s.icon];
                return (
                  <li key={s.id}>
                    <Link
                      href={serviceHref(s)}
                      className="group flex h-full min-h-16 items-center gap-3 rounded-2xl border border-line/70 bg-white px-4 py-3 font-semibold text-forest transition-colors duration-200 hover:border-brass hover:bg-cream-deep"
                    >
                      <OtherIcon aria-hidden="true" strokeWidth={1.6} className="size-5 shrink-0 text-brass-ink" />
                      <span className="flex-1">{text(s).shortTitle}</span>
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
      ) : null}

      <EnquiryCta
        id="service-cta-title"
        title="Ask about {name}"
        titleVars={{ name }}
        intro="Call or WhatsApp the store. Specific terms are confirmed for each enquiry."
        enquiry={{ subject }}
      />
    </div>
  );
}

/** While the live service loads: a placeholder the size of the page (no bundled text). */
function ServiceLoading() {
  const t = useT();
  return (
    <section data-service-state="loading" aria-busy="true" className="min-h-svh bg-cream py-16 lg:py-24">
      <Container size="wide">
        <p role="status" className="text-center text-sm text-ink-muted">
          {t("Loading services…")}
        </p>
        <div aria-hidden="true" className="mt-8 grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6">
            <div className="h-10 w-3/4 rounded-lg bg-forest/10 motion-safe:animate-pulse" />
            <div className="h-24 rounded-lg bg-forest/10 motion-safe:animate-pulse" />
          </div>
          <div className="aspect-[4/3] rounded-[1.75rem] bg-forest/10 motion-safe:animate-pulse lg:col-span-6" />
        </div>
      </Container>
    </section>
  );
}

function StateMessage({ state, icon, title, text }: { state: string; icon: ReactNode; title: string; text: string }) {
  const t = useT();
  return (
    <section data-service-state={state} className="bg-cream py-16 lg:py-24">
      <Container size="wide">
        <div className="mx-auto max-w-2xl rounded-2xl border border-line/70 bg-white p-8 text-center sm:p-12">
          {icon}
          <h1 className="mt-4 font-display text-3xl text-forest">{t(title)}</h1>
          <p
            role="status"
            data-service-hidden={state === "hidden" ? "" : undefined}
            className="mx-auto mt-3 max-w-lg text-ink-muted"
          >
            {t(text)}
          </p>
          <div className="contact-actions mt-6" data-contact-actions>
            <Link href="/services/" className="contact-action text-forest hover:text-brass-ink">
              <ArrowLeft aria-hidden="true" className="size-4" /> {t("Back to Services")}
            </Link>
            <a href={telHref} className="contact-action text-forest hover:text-brass-ink">
              <Phone aria-hidden="true" className="size-4" /> {t("Call {phone}", { phone: business.phone.display })}
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}

/** Not published in the Admin (hidden, or never added). */
function ServiceHidden() {
  return (
    <StateMessage
      state="hidden"
      icon={<Info aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
      title="Service not available"
      text="This service is not listed at the moment. Please call or WhatsApp the store to ask about it."
    />
  );
}

/** The API is not configured or could not be reached. */
function ServiceUnavailable() {
  return (
    <StateMessage
      state="unavailable"
      icon={<CloudOff aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
      title="Temporarily unavailable"
      text="We could not load this page right now. Please try again in a moment, or call or WhatsApp the store."
    />
  );
}
