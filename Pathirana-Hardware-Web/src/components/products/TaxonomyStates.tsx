"use client";

import type { ReactNode } from "react";
import { CloudOff, PackageSearch, PackageX, Phone } from "lucide-react";
import { business, telHref, whatsappEnquiryHref } from "@/content/business";
import type { LiveStatus } from "@/lib/live-taxonomy";
import { useLiveCategory } from "@/lib/live-taxonomy";
import { liveCatalogueEnabled } from "@/lib/catalogue";
import { Message, ProductDetailSkeleton } from "./ProductDetail";

const COPY = {
  categories: {
    empty: ["Product categories are being added", "Our online catalogue is being prepared."],
    error: ["Categories temporarily unavailable", "We could not load the categories right now."],
  },
  brands: {
    empty: ["Brands are being added", "Our brand list is being prepared."],
    error: ["Brands temporarily unavailable", "We could not load the brands right now."],
  },
} as const;

/**
 * Honest state of a live category / brand list when there is nothing to show:
 * "being added" (the API answered with no active entries) or "temporarily
 * unavailable" (the API failed) — never substitute data. Renders nothing for
 * the other states.
 */
export function TaxonomyNotice({
  status,
  kind,
  onRetry,
  compact = false,
  tone = "light",
}: {
  status: LiveStatus;
  kind: "categories" | "brands";
  onRetry?: () => void;
  /** One short line (for small spots such as "Other categories"). */
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  if (status !== "empty" && status !== "error") return null;
  const [title, lead] = COPY[kind][status];
  const muted = tone === "dark" ? "text-sage" : "text-ink-muted";
  const link = tone === "dark" ? "text-gold-soft hover:text-white" : "text-forest hover:text-brass-ink";
  const actions = (
    <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1 font-semibold">
      {status === "error" && onRetry ? (
        <button type="button" onClick={onRetry} className={`min-h-11 underline underline-offset-4 ${link}`}>
          Try again
        </button>
      ) : null}
      <a href={telHref} className={`inline-flex min-h-11 items-center gap-1.5 ${link}`}>
        <Phone aria-hidden="true" className="size-4" /> Call {business.phone.display}
      </a>
      <a
        href={whatsappEnquiryHref("your products")}
        target="_blank"
        rel="noopener noreferrer"
        className={`min-h-11 ${link}`}
      >
        WhatsApp us
      </a>
    </span>
  );
  if (compact) {
    return (
      <p
        role={status === "error" ? "alert" : undefined}
        data-taxonomy-notice={status}
        className={`flex flex-wrap items-center gap-x-4 text-sm ${muted}`}
      >
        <span>
          {title}. {lead}
        </span>
        {actions}
      </p>
    );
  }
  const Icon = status === "error" ? CloudOff : PackageSearch;
  return (
    <div
      role={status === "error" ? "alert" : undefined}
      data-taxonomy-notice={status}
      className={`mx-auto max-w-2xl rounded-2xl border p-6 text-center sm:p-8 ${
        tone === "dark" ? "border-white/15 bg-white/5" : "border-line/70 bg-white"
      }`}
    >
      <Icon aria-hidden="true" className={`mx-auto size-8 ${tone === "dark" ? "text-gold-soft" : "text-brass-ink"}`} />
      <h3 className={`mt-3 font-display text-xl ${tone === "dark" ? "text-white" : "text-forest"}`}>{title}</h3>
      <p className={`mx-auto mt-2 max-w-lg text-sm ${muted}`}>
        {lead} Call or WhatsApp the store and we will help with what you need.
      </p>
      <div className="mt-3 flex justify-center text-sm">{actions}</div>
    </div>
  );
}

/**
 * Static (documented) category and product-type pages: with the live API, the
 * page content is shown only while its category is ACTIVE. A category staff
 * deactivated shows an honest "not available" message instead, so old direct
 * URLs never present it as part of the current catalogue.
 */
export function ActiveCategoryGate({
  slug,
  what,
  children,
}: {
  slug: string;
  what: "category" | "product";
  children: ReactNode;
}) {
  if (!liveCatalogueEnabled()) return <>{children}</>;
  return (
    <LiveGate slug={slug} what={what}>
      {children}
    </LiveGate>
  );
}

function LiveGate({ slug, what, children }: { slug: string; what: "category" | "product"; children: ReactNode }) {
  const { status, retry } = useLiveCategory(slug);
  if (status === "found") return <div data-category-gate="active">{children}</div>;
  if (status === "missing") {
    return (
      <Message
        state="not-found"
        icon={<PackageX aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
        title={what === "category" ? "Category not available" : "Product not available"}
        text={`This ${what === "category" ? "category" : "product"} is not part of our online catalogue at the moment. Browse our products, or call or WhatsApp the store.`}
      />
    );
  }
  if (status === "error") {
    return (
      <Message
        state="unavailable"
        icon={<CloudOff aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
        title="Temporarily unavailable"
        text="We could not load this page right now. Please try again in a moment, or call or WhatsApp the store."
        onRetry={retry}
      />
    );
  }
  return <ProductDetailSkeleton />;
}
