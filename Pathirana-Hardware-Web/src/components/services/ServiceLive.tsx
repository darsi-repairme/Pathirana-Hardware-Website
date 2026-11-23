"use client";

import { CircleCheck, Info } from "lucide-react";
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
