import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { whatsappProductEnquiryHref } from "@/content/business";
import { getCategory, type ProductType } from "@/content/products";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { ProductTypeVisual } from "./ProductVisual";

/**
 * Product-type card: image, category tag, name, summary, View details and a
 * WhatsApp enquiry. The whole card (except WhatsApp) opens the product page.
 */
export function ProductTypeCard({
  product,
  headingLevel = "h3",
  sizes = "(min-width: 1280px) 300px, (min-width: 1024px) 24vw, (min-width: 640px) 50vw, 40vw",
}: {
  product: ProductType;
  headingLevel?: "h2" | "h3";
  sizes?: string;
}) {
  const Heading = headingLevel;
  const category = getCategory(product.category);
  const href = `/products/${product.slug}/`;
  return (
    // Phones: image beside the text (as the home product cards); from sm: image on top.
    <article className="zoom-img group relative flex h-full flex-row overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-white shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-soft)] focus-within:border-brass/50 hover:-translate-y-1 hover:border-brass/40 hover:shadow-[var(--shadow-lift)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:flex-col">
      <div className="relative w-[38%] shrink-0 overflow-hidden bg-forest-900 sm:aspect-[4/3] sm:w-auto">
        <ProductTypeVisual product={product} sizes={sizes} decorative />
        {category ? (
          <span className="absolute top-2 left-2 max-w-[calc(100%-1rem)] rounded-full bg-forest-900/85 px-2 py-0.5 text-[0.68rem] font-semibold text-gold-soft backdrop-blur-sm max-sm:leading-snug sm:top-3 sm:left-3 sm:max-w-none sm:px-3 sm:py-1 sm:text-xs">
            {category.title}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col border-l-2 border-brass p-4 sm:border-t-2 sm:border-l-0 sm:p-6">
        <Heading className="font-display text-xl font-semibold text-forest sm:text-2xl">
          {/* Stretched link: the whole card opens the product page. */}
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </Heading>
        <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink-muted sm:mt-2 sm:text-base">{product.summary}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3 sm:gap-3 sm:pt-5">
          <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest">
            View details
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
            />
          </span>
          <a
            href={whatsappProductEnquiryHref(product.enquiryName)}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 inline-flex size-11 items-center justify-center rounded-full bg-[#177a42] text-white shadow-[0_10px_20px_-12px_rgb(23_122_66/0.9)] transition-colors duration-200 hover:bg-[#11653a]"
          >
            <WhatsAppIcon className="size-5" />
            <span className="sr-only">Enquire about {product.name} on WhatsApp (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </article>
  );
}
