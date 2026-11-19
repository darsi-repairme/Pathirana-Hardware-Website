"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, Clock, Package } from "lucide-react";
import { whatsappProductEnquiryHref } from "@/content/business";
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
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { IconPanel } from "./ProductVisual";

const AVAILABILITY_STYLE: Record<Availability, { className: string; icon: typeof CircleCheck }> = {
  available: { className: "bg-forest-50 text-forest", icon: CircleCheck },
  out_of_stock: { className: "bg-cream-deep text-logo-red", icon: CircleX },
  on_request: { className: "bg-brass-100 text-brass-ink", icon: Clock },
};

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const { className, icon: Icon } = AVAILABILITY_STYLE[availability];
  return (
    <span
      data-availability={availability}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {AVAILABILITY_LABEL[availability]}
    </span>
  );
}

/**
 * The API-calculated price: "Contact for Price", or the original price with
 * an active offer and the final price. Never calculates anything itself.
 */
export function PriceTag({ product, size = "md" }: { product: LiveProduct; size?: "md" | "lg" }) {
  const price = priceOf(product);
  const unit = product.unit ? <span className="text-sm font-normal text-ink-muted"> / {product.unit}</span> : null;
  if (price.contactForPrice || !price.final) {
    return (
      <p data-price="contact" className={`font-semibold text-forest ${size === "lg" ? "text-2xl" : "text-lg"}`}>
        Contact for Price
      </p>
    );
  }
  const d = price.discount;
  return (
    <div data-price="priced">
      {d ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-muted line-through">
            <span className="sr-only">Original price: </span>
            {formatLkr(price.original!)}
          </span>
          <span className="rounded-full bg-logo-red px-2 py-0.5 text-xs font-semibold text-white">
            {d.type === "percentage" ? `${formatPercent(d.value)} off` : `Save ${formatLkr(d.amount)}`}
          </span>
        </p>
      ) : null}
      <p
        className={`font-display font-semibold text-forest ${size === "lg" ? "mt-1 text-[2rem] leading-tight" : "text-xl"}`}
      >
        {d ? <span className="sr-only">Offer price: </span> : null}
        {formatLkr(price.final)}
        {unit}
      </p>
      {d && size === "lg" ? (
        <p className="mt-1 text-sm text-ink-muted">
          You save {formatLkr(d.amount)}
          {d.endsOn ? ` · offer ends ${formatDate(d.endsOn)}` : ""}
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
  const meta = [product.category.name, ...product.brands.map((b) => b.name)].join(" · ");
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
            {product.name}
          </Link>
        </h3>
        {product.summary ? (
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted">{product.summary}</p>
        ) : null}
        <div className="mt-auto pt-4">
          <PriceTag product={product} />
          <a
            href={whatsappProductEnquiryHref(product.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#177a42] px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#11653a]"
          >
            <WhatsAppIcon className="size-4" /> Enquire on WhatsApp
            <span className="sr-only"> about {product.name} (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </article>
  );
}
