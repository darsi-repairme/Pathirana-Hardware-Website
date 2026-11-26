"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, Clock, Package } from "lucide-react";
import { useDynamicText, useEnquiryHref, useLocale, useT } from "@/i18n/I18nProvider";
import { LOCALE_META } from "@/i18n/config";
import {
  AVAILABILITY_LABEL,
  formatDate,
  formatLkr,
  formatPercent,
  imageSrc,
  priceOf,
  productHref,
  type Availability,
  type LiveImage,
  type LiveProduct,
} from "@/lib/catalogue";
import { whatsappCta } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { IconPanel } from "./ProductVisual";

const AVAILABILITY_STYLE: Record<Availability, { className: string; icon: typeof CircleCheck }> = {
  available: { className: "bg-forest-50 text-forest", icon: CircleCheck },
  out_of_stock: { className: "bg-cream-deep text-logo-red", icon: CircleX },
  on_request: { className: "bg-brass-100 text-brass-ink", icon: Clock },
};

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const { className, icon: Icon } = AVAILABILITY_STYLE[availability];
  const t = useT();
  return (
    <span
      data-availability={availability}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {t(AVAILABILITY_LABEL[availability])}
    </span>
  );
}

/**
 * The API-calculated price: "Contact for Price", or the original price with
 * an active offer and the final price. Never calculates anything itself.
 */
export function PriceTag({ product, size = "md" }: { product: LiveProduct; size?: "md" | "lg" }) {
  const price = priceOf(product);
  const { t, locale } = useLocale();
  const unit = product.unit ? <span className="text-sm font-normal text-ink-muted"> / {product.unit}</span> : null;
  if (price.contactForPrice || !price.final) {
    return (
      <p data-price="contact" className={`font-semibold text-forest ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        {t("Contact for Price")}
      </p>
    );
  }
  const d = price.discount;
  return (
    <div data-price="priced">
      {d ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-muted line-through">
            <span className="sr-only">{t("Original price:")} </span>
            {formatLkr(price.original!)}
          </span>
          <span className="rounded-full bg-logo-red px-2 py-0.5 text-xs font-semibold text-white">
            {d.type === "percentage"
              ? t("{percent} off", { percent: formatPercent(d.value) })
              : t("Save {amount}", { amount: formatLkr(d.amount) })}
          </span>
        </p>
      ) : null}
      <p
        className={`font-display font-semibold text-forest ${size === "lg" ? "mt-1 text-[2rem] leading-tight" : "text-xl"}`}
      >
        {d ? <span className="sr-only">{t("Offer price:")} </span> : null}
        {formatLkr(price.final)}
        {unit}
      </p>
      {d && size === "lg" ? (
        <p className="mt-1 text-sm text-ink-muted">
          {t("You save {amount}", { amount: formatLkr(d.amount) })}
          {d.endsOn ? ` · ${t("offer ends {date}", { date: formatDate(d.endsOn, LOCALE_META[locale].htmlLang) })}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/** A published product image from the API; an honest icon panel if there is none (or it fails). */
export function LiveProductImage({
  image,
  thumb = true,
  eager = false,
  decorative = false,
}: {
  image: LiveImage | null | undefined;
  thumb?: boolean;
  eager?: boolean;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return <IconPanel icon={Package} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image served by the separate API (static export has no image server)
    <img
      src={imageSrc(thumb ? image.thumbUrl : image.url)}
      alt={decorative ? "" : image.alt}
      width={image.width}
      height={image.height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

/** Listing card in the existing card style, with unit, price and availability. */
export function LiveProductCard({ product }: { product: LiveProduct }) {
  const t = useT();
  const pick = useDynamicText();
  const enquiryHref = useEnquiryHref();
  const name = pick(product.name, product.translations, "name");
  const summary = pick(product.summary, product.translations, "summary");
  const meta = [
    pick(product.category.name, product.category.translations, "name"),
    ...product.brands.map((b) => b.name),
  ].join(" · ");
  return (
    <article
      data-product={product.slug}
      className="zoom-img group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:border-brass/40 hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-forest-900 sm:aspect-[4/3]">
        <LiveProductImage image={product.image} decorative />
        <span className="absolute top-3 left-3">
          <AvailabilityBadge availability={product.availability} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold tracking-[0.12em] text-brass-ink uppercase">{meta}</p>
        <h3 className="mt-1.5 font-display text-xl font-semibold text-forest">
          {/* Stretched link: the card opens the product page. */}
          <Link
            href={productHref(product.slug)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {name}
          </Link>
        </h3>
        {summary ? <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">{summary}</p> : null}
        <div className="mt-auto pt-4">
          <PriceTag product={product} />
          <a
            href={enquiryHref({
              name,
              price: priceOf(product),
              unit: product.unit,
              path: productHref(product.slug),
              // Live products load in the browser; the origin is used only if it is public.
              origin: typeof window === "undefined" ? null : window.location.origin,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className={`${whatsappCta} mt-4`}
          >
            <WhatsAppIcon className="size-4" /> {t("Enquire on WhatsApp")}
            <span className="sr-only"> {t("about {name} (opens in a new tab)", { name })}</span>
          </a>
        </div>
      </div>
    </article>
  );
}
