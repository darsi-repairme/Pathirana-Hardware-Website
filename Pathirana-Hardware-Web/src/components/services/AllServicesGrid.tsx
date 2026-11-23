"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Search, SearchX, X } from "lucide-react";
import { whatsappEnquiryHref } from "@/content/business";
import { useLocale } from "@/i18n/I18nProvider";
import { useServiceText, useSiteServices, type SiteService } from "@/lib/live-services";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { serviceIcons } from "./ServiceIcon";
import { ServiceActions } from "./ServiceActions";

const control =
  "h-12 w-full rounded-full border border-line-strong bg-white text-[0.95rem] text-charcoal transition-[border-color,box-shadow] duration-300 outline-none hover:border-brass focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.2)]";

const norm = (v: string) => v.toLocaleLowerCase().normalize("NFC");

/**
 * /services/all/ — every published service (the six approved ones and any the owner adds in the
 * Admin) as an image card, in staff order. The photo is the one uploaded in Admin → Services; a
 * service without one gets a plain branded panel (no stand-in photo). Independent of the 3D scenes.
 */
export function AllServicesGrid() {
  const { services, status } = useSiteServices();
  const text = useServiceText();
  const { t } = useLocale();
  const id = useId();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => services.map((s) => ({ s, st: text(s) })), [services, text]);
  const q = norm(query.trim());
  const shown = q
    ? rows.filter(({ s, st }) =>
        [st.title, st.summary, st.description, s.title, s.summary].some((v) => norm(v).includes(q)),
      )
    : rows;

  // Services added in the Admin arrive after load, so a /services/all/#<slug> link scrolls once they exist.
  useEffect(() => {
    const slug = decodeURIComponent(window.location.hash.slice(1));
    if (!slug || status === "loading") return;
    const el = document.getElementById(slug);
    if (!el?.matches("[data-service-card]")) return;
    el.querySelector("details")?.setAttribute("open", "");
    el.scrollIntoView({ block: "start" });
  }, [status]);

  // While the live list loads, show placeholders rather than the bundled six: a service the
  // owner has hidden must never flash on screen. (If the API fails, the bundled six are shown.)
  if (status === "loading")
    return (
      <div data-services-status="loading" aria-busy="true">
        <p role="status" className="mt-4 text-center text-sm text-ink-muted">
          {t("Loading services…")}
        </p>
        <ul aria-hidden="true" className="mt-8 grid gap-6 sm:grid-cols-2 lg:gap-8 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li
              key={i}
              className="h-[26rem] rounded-[var(--radius-card)] bg-forest/10 ring-1 ring-line/70 motion-safe:animate-pulse"
            />
          ))}
        </ul>
      </div>
    );

  if (!services.length)
    return (
      <p className="mt-10 text-center text-lg text-ink-muted">
        {t("Please call or WhatsApp the store to ask about our services.")}
      </p>
    );

  return (
    <>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mx-auto max-w-xl">
        <label htmlFor={`${id}-q`} className="sr-only">
          {t("Search services")}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-brass-ink"
        />
        <input
          id={`${id}-q`}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={t("Search services")}
          maxLength={80}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${control} pl-12 ${query ? "pr-12" : "pr-4"} placeholder:text-ink-muted [&::-webkit-search-cancel-button]:appearance-none`}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-1.5 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-cream-deep"
          >
            <X aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("Clear search text")}</span>
          </button>
        ) : null}
      </form>

      <p role="status" className="mt-4 text-center text-sm text-ink-muted">
        {shown.length === 1 ? t("1 service") : t("{n} services", { n: shown.length })}
      </p>

      {shown.length ? (
        <ul
          className="mt-8 grid gap-6 sm:grid-cols-2 lg:gap-8 xl:grid-cols-3"
          data-all-services
          data-services-status={status}
        >
          {shown.map(({ s, st }) => (
            <ServiceCard key={s.id} service={s} text={st} />
          ))}
        </ul>
      ) : (
        <div className="mx-auto mt-10 max-w-md text-center">
          <SearchX aria-hidden="true" className="mx-auto size-9 text-brass-ink" />
          <p className="mt-3 text-lg text-charcoal">{t("No services match “{q}”.", { q: query.trim() })}</p>
          <button type="button" onClick={() => setQuery("")} className="link-underline mt-3 font-semibold text-forest">
            {t("Clear search")}
          </button>
        </div>
      )}
    </>
  );
}

function ServiceCard({
  service: s,
  text: st,
}: {
  service: SiteService;
  text: ReturnType<ReturnType<typeof useServiceText>>;
}) {
  const { t, locale } = useLocale();
  const Icon = serviceIcons[s.icon];
  const details = st.description.trim() || st.howToAsk.trim();
  return (
    <li
      id={s.id}
      data-service-card
      className="flex min-w-0 scroll-mt-32 flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[0_18px_40px_-30px_rgb(7_46_29/0.55)] ring-1 ring-line/70"
    >
      {s.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- staff-uploaded photo served by the API
        <img
          src={s.image.thumbUrl}
          srcSet={`${s.image.thumbUrl} 480w, ${s.image.url} 1600w`}
          sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
          alt={s.image.alt}
          width={s.image.width}
          height={s.image.height}
          loading="lazy"
          decoding="async"
          className="aspect-[16/10] w-full bg-cream-deep object-cover"
        />
      ) : (
        // No uploaded photo yet: a deliberate branded panel, never a stand-in photograph.
        <div
          data-image-fallback
          className="flex aspect-[16/10] w-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,var(--color-forest-800),var(--color-forest-900)_75%)]"
        >
          <span className="inline-flex size-20 items-center justify-center rounded-full border border-gold-soft/40 bg-forest-900/60 text-gold-soft">
            <Icon aria-hidden="true" strokeWidth={1.4} className="size-9" />
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Icon aria-hidden="true" strokeWidth={1.6} className="mt-1 size-5 shrink-0 text-brass-ink" />
          <h2 className="min-w-0 font-display text-[1.35rem] leading-tight font-semibold break-words text-charcoal">
            {st.title}
          </h2>
        </div>
        <span aria-hidden="true" className="mt-3 block h-0.5 w-10 rounded-full bg-brass" />
        {st.summary ? <p className="mt-3 leading-relaxed text-ink-muted">{st.summary}</p> : null}

        {details ? (
          <details className="group mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold text-forest hover:text-forest-800 [&::-webkit-details-marker]:hidden">
              {t("More details")}
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            {st.description.trim() ? (
              <p className="mt-1 leading-relaxed break-words whitespace-pre-line text-ink-muted">{st.description}</p>
            ) : null}
            {st.howToAsk.trim() ? (
              <p className="mt-3 text-sm leading-relaxed break-words text-ink-muted">
                <strong className="font-semibold text-charcoal">{t("How to ask:")}</strong> {st.howToAsk}
              </p>
            ) : null}
          </details>
        ) : null}

        <div className="mt-auto pt-5">
          {s.hasPage ? (
            <ServiceActions service={s} />
          ) : (
            <Button
              href={whatsappEnquiryHref(st.title, locale)}
              external
              variant="gold"
              icon={<WhatsAppIcon />}
              ariaLabel={t("Enquire about {name} on WhatsApp (opens in a new tab)", { name: st.title })}
              className="w-full"
            >
              {t("Enquire")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
