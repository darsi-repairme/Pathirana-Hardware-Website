"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CircleCheck, Info, Phone } from "lucide-react";
import { business, telHref } from "@/content/business";
import { Container } from "@/components/ui/Container";
import { useT } from "@/i18n/I18nProvider";
import { useServiceText, useSiteServices } from "@/lib/live-services";

type Field = "title" | "summary" | "description" | "howToAsk";

/** The live (staff-edited) text of one service field on its pre-built page; the bundled text until then. */
export function ServiceLiveText({ slug, field, fallback }: { slug: string; field: Field; fallback: string }) {
  const { services } = useSiteServices();
  const text = useServiceText();
  const t = useT();
  const s = services.find((x) => x.id === slug);
  return <>{s ? text(s)[field] : t(fallback)}</>;
}

/** "What you can enquire about" — live list when staff have edited it. */
export function ServiceEnquireList({ slug, fallback }: { slug: string; fallback: readonly string[] }) {
  const { services } = useSiteServices();
  const text = useServiceText();
  const t = useT();
  const s = services.find((x) => x.id === slug);
  const items = s ? text(s).enquireAbout : fallback.map((x) => t(x));
  return (
    <ul className="mt-6 space-y-4">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-lg leading-snug text-cream">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gold-soft" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Shown on a pre-built service page that staff have since hidden in the Admin. */
export function ServiceHiddenNotice({ slug }: { slug: string }) {
  const { services, status } = useSiteServices();
  const t = useT();
  if (status !== "live" || services.some((s) => s.id === slug)) return null;
  return (
    <p
      role="status"
      data-service-hidden
      className="mt-6 flex items-start gap-3 rounded-2xl border border-brass/50 bg-white px-5 py-4 text-sm leading-relaxed text-charcoal"
    >
      <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brass-ink" />
      {t("This service is not listed at the moment. Please call or WhatsApp the store to ask about it.")}
    </p>
  );
}

/** True only when the live list has loaded and this service is NOT published (hidden by staff). */
function useServiceHidden(slug: string) {
  const { services, status } = useSiteServices();
  return status === "live" && !services.some((s) => s.id === slug);
}

/**
 * A pre-built service page (static export, so no HTTP 404 is possible): once the live list shows
 * that staff have hidden this service, its content (and enquiry buttons) is replaced by an
 * "unavailable" state. Loading, no API, or an unreachable API: the page shows as before.
 */
export function ServiceAvailability({ slug, children }: { slug: string; children: ReactNode }) {
  const hidden = useServiceHidden(slug);
  const t = useT();
  if (!hidden) return <>{children}</>;
  return (
    <section data-service-state="hidden" className="bg-cream py-16 lg:py-24">
      <Container size="wide">
        <div className="mx-auto max-w-2xl rounded-2xl border border-line/70 bg-white p-8 text-center sm:p-12">
          <Info aria-hidden="true" className="mx-auto size-10 text-brass-ink" />
          <h1 className="mt-4 font-display text-3xl text-forest">{t("Service not available")}</h1>
          <p role="status" data-service-hidden className="mx-auto mt-3 max-w-lg text-ink-muted">
            {t("This service is not listed at the moment. Please call or WhatsApp the store to ask about it.")}
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

/** Wraps a link to another service: rendered only while that service is published (live list). */
export function ServiceListed({ slug, children }: { slug: string; children: ReactNode }) {
  return useServiceHidden(slug) ? null : <>{children}</>;
}
