"use client";

import Link from "next/link";
import { approvedOnly, serviceHref, useServiceText, useSiteServices } from "@/lib/live-services";
import { serviceIcons } from "./ServiceIcon";
import { ServiceActions } from "./ServiceActions";
import { ServicesPending } from "./ServicesPending";

/**
 * /services/ › All Services — open rows split by hairlines, two equal actions each.
 * Live from the Admin (published services, staff order); each row is an anchor
 * (`/services/#<slug>`) so services without a pre-built page are still reachable.
 */
export function ServicesList() {
  const live = useSiteServices();
  const services = approvedOnly(live.services);
  const text = useServiceText();
  if (!services.length) return <ServicesPending status={live.status} className="mt-10 text-lg" />;
  return (
    <ol className="mt-10 grid gap-x-10 md:grid-cols-2 xl:grid-cols-3" data-services-list>
      {services.map((s, i) => {
        const Icon = serviceIcons[s.icon];
        const st = text(s);
        return (
          <li key={s.id} id={s.id} className="flex scroll-mt-32 flex-col border-t border-line py-7">
            {s.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- staff-uploaded photo served by the API
              <img
                src={s.image.thumbUrl}
                alt={s.image.alt}
                width={s.image.width}
                height={s.image.height}
                loading="lazy"
                decoding="async"
                className="mb-5 aspect-[16/10] w-full rounded-[var(--radius-card)] object-cover ring-1 ring-line/70"
              />
            ) : null}
            <div className="flex items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-brass/50 bg-forest text-gold-soft">
                <Icon aria-hidden="true" strokeWidth={1.6} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm text-brass-ink">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="font-display text-[1.45rem] leading-tight font-semibold text-charcoal">
                  {s.hasPage ? (
                    <Link href={serviceHref(s)} className="hover:text-forest">
                      {st.title}
                    </Link>
                  ) : (
                    st.title
                  )}
                </h3>
              </div>
            </div>
            <p className="mt-3 flex-1 leading-relaxed whitespace-pre-line text-ink-muted">{st.description}</p>
            <ServiceActions service={s} className="mt-5" />
          </li>
        );
      })}
    </ol>
  );
}
