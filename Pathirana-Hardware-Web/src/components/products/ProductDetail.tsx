"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ClipboardList, CloudOff, Info, PackageX, Phone, Ruler, Tag } from "lucide-react";
import { business, telHref } from "@/content/business";
import { T, useDynamicText, useEnquiryHref, useT } from "@/i18n/I18nProvider";
import {
  fetchProduct,
  liveCatalogueEnabled,
  NotFoundError,
  priceOf,
  productHref,
  type LiveProduct,
} from "@/lib/catalogue";
import { quotationHref } from "@/lib/quotation";
import { categoryHref } from "@/lib/taxonomy";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { AvailabilityBadge, LiveProductImage, PriceTag } from "./LiveProductParts";

type State = { slug: string; product?: LiveProduct; error?: "not-found" | "unavailable" };

export function ProductDetailSkeleton() {
  return (
    // Phones / tablets: at least one screen tall, so the footer is not shown while loading and then
    // pushed away (layout shift). The breadcrumb placeholder keeps the image where it will appear.
    <section aria-busy="true" className="min-h-svh bg-cream pt-6 pb-16 sm:pt-8 lg:min-h-0 lg:pb-24">
      <Container size="wide">
        <p className="sr-only" role="status">
          <T>Loading product…</T>
        </p>
        <div aria-hidden="true" className="h-5 w-56 max-w-full rounded bg-cream-deep" />
        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="aspect-[4/3] rounded-[var(--radius-panel)] bg-forest-900/10 motion-safe:animate-pulse lg:col-span-6" />
          <div className="space-y-4 lg:col-span-6">
            <div className="h-4 w-24 rounded bg-cream-deep" />
            <div className="h-12 w-3/4 rounded bg-cream-deep" />
            <div className="h-24 rounded bg-cream-deep" />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** Reads ?slug= and shows that published product (or an honest not-found / unavailable state). */
export function ProductDetail() {
  const slug = useSearchParams().get("slug") ?? "";
  const [state, setState] = useState<State | null>(null);
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState(0);
  const enabled = liveCatalogueEnabled();
  const t = useT();
  const pick = useDynamicText();
  const enquiryHref = useEnquiryHref();

  useEffect(() => {
    if (!slug || !enabled) return;
    const ctrl = new AbortController();
    fetchProduct(slug, ctrl.signal)
      .then((product) => {
        setActive(0);
        setState({ slug, product });
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setState({ slug, error: e instanceof NotFoundError ? "not-found" : "unavailable" });
      });
    return () => ctrl.abort();
  }, [slug, enabled, retry]);

  const current = state?.slug === slug ? state : null;
  const product = current?.product;
  const name = product ? pick(product.name, product.translations, "name") : "";

  useEffect(() => {
    if (product) document.title = `${name} | ${business.shortName}`;
  }, [product, name]);

  if (!slug || (enabled && current?.error === "not-found")) {
    return (
      <Message
        state="not-found"
        icon={<PackageX aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
        title="Product not found"
        text="This product is not listed online, or it is no longer available. Browse our products, or call or WhatsApp the store."
      />
    );
  }
  if (!enabled || current?.error === "unavailable") {
    return (
      <Message
        state="unavailable"
        icon={<CloudOff aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
        title="Product details temporarily unavailable"
        text="We could not load this product right now. Please try again in a moment, or call or WhatsApp the store."
        onRetry={enabled ? () => setRetry((n) => n + 1) : undefined}
      />
    );
  }
  if (!product) return <ProductDetailSkeleton />;

  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  const shown = images[Math.min(active, images.length - 1)] ?? null;
  // Shared product enquiry: displayed (final) price, no invented reference, public link only.
  const enquiry = enquiryHref({
    name,
    price: priceOf(product),
    unit: product.unit,
    path: productHref(product.slug),
    origin: window.location.origin,
  });

  return (
    <section
      data-product-detail={product.slug}
      aria-labelledby="product-title"
      className="bg-cream pt-6 pb-16 sm:pt-8 lg:pb-24"
    >
      <Container size="wide">
        <Breadcrumbs
          tone="light"
          current={name}
          parents={[
            { label: "Products", href: "/products/" },
            {
              label: pick(product.category.name, product.category.translations, "name"),
              href: categoryHref(product.category.slug),
            },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14 land:grid-cols-12 land:gap-8">
          {/* Images: main image first, then the additional images */}
          <div className="hero-enter lg:col-span-6 land:col-span-6">
            <figure className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-3 translate-y-3 rounded-[var(--radius-panel)] border-2 border-brass/50 sm:translate-x-4 sm:translate-y-4"
              />
              <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] bg-forest-900 shadow-[var(--shadow-lift)]">
                <LiveProductImage key={shown?.url ?? "none"} image={shown} thumb={false} eager />
              </div>
            </figure>
            {images.length > 1 ? (
              <ul className="mt-8 flex flex-wrap gap-3" aria-label={t("Product images")}>
                {images.map((img, i) => (
                  <li key={img.url}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-pressed={i === active}
                      className={`relative block size-20 overflow-hidden rounded-xl border-2 bg-forest-900 transition-colors sm:size-24 ${
                        i === active ? "border-brass" : "border-transparent hover:border-brass/50"
                      }`}
                    >
                      <LiveProductImage image={img} decorative />
                      <span className="sr-only">
                        {t("Show image {n}:", { n: i + 1 })} {img.alt}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Details */}
          <div className="hero-enter lg:col-span-6 land:col-span-6">
            <Eyebrow>{t("Product")}</Eyebrow>
            <h1
              id="product-title"
              className="mt-4 font-display text-[2.6rem] leading-[1.05] font-medium tracking-[-0.01em] text-charcoal sm:text-6xl"
            >
              {name}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                href={categoryHref(product.category.slug)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-forest-50 px-4 text-sm font-semibold text-forest hover:bg-brass-100"
              >
                <Tag aria-hidden="true" className="size-4 text-brass-ink" />
                {t("Category:")} {pick(product.category.name, product.category.translations, "name")}
              </Link>
              {product.brands.map((b) => (
                <span
                  key={b.slug}
                  className="inline-flex min-h-10 items-center rounded-full border border-line-strong bg-white px-4 text-sm font-semibold text-charcoal"
                >
                  {t("Brand:")} {b.name}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-[var(--radius-card)] border border-line/70 bg-white p-6 shadow-[var(--shadow-card)] sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <PriceTag product={product} size="lg" />
                <AvailabilityBadge availability={product.availability} />
              </div>
              {product.unit ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                  <Ruler aria-hidden="true" className="size-4 text-brass-ink" /> {t("Unit of sale:")} {product.unit}
                </p>
              ) : null}
              <ButtonPair className="mt-6 border-t border-line/70 pt-6">
                <Button href={enquiry} external icon={<WhatsAppIcon />} className="!bg-[#177a42] hover:!bg-[#11653a]">
                  {t("Enquire on WhatsApp")}
                </Button>
                <Button href={telHref} variant="outline" icon={<Phone />}>
                  {t("Call Us")}
                </Button>
              </ButtonPair>
              <Button
                href={quotationHref(product.name, product.slug)}
                variant="gold"
                icon={<ClipboardList />}
                className="mt-3 w-full"
              >
                {t("Request a Quotation")}
              </Button>
            </div>

            {product.summary ? (
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-charcoal">
                {pick(product.summary, product.translations, "summary")}
              </p>
            ) : null}
            {product.description ? (
              <p className="mt-4 max-w-xl leading-relaxed whitespace-pre-line text-ink-muted">
                {pick(product.description, product.translations, "description")}
              </p>
            ) : null}

            <p className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brass-ink" />
              {t("Prices and availability can change. Please confirm with the store when you enquire.")}
            </p>
            <Link
              href="/products/#all-products"
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-forest hover:text-brass-ink"
            >
              <ArrowLeft aria-hidden="true" className="size-4" /> {t("Back to Products")}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function Message({
  state,
  icon,
  title,
  text,
  onRetry,
}: {
  state: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  onRetry?: () => void;
}) {
  const t = useT();
  return (
    <section data-product-state={state} className="bg-cream py-16 lg:py-24">
      <Container size="wide">
        <div
          role={state === "unavailable" ? "alert" : undefined}
          className="mx-auto max-w-2xl rounded-2xl border border-line/70 bg-white p-8 text-center sm:p-12"
        >
          {icon}
          <h1 className="mt-4 font-display text-3xl text-forest">{t(title)}</h1>
          <p className="mx-auto mt-3 max-w-lg text-ink-muted">{t(text)}</p>
          <div className="contact-actions mt-6" data-contact-actions>
            <Link href="/products/" className="contact-action text-forest hover:text-brass-ink">
              <ArrowLeft aria-hidden="true" className="size-4" /> {t("Back to Products")}
            </Link>
            <a href={telHref} className="contact-action text-forest hover:text-brass-ink">
              <Phone aria-hidden="true" className="size-4" /> {t("Call {phone}", { phone: business.phone.display })}
            </a>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="contact-action text-forest underline underline-offset-4"
              >
                {t("Try again")}
              </button>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
