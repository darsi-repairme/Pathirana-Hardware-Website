"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CloudOff, PackageX, Phone } from "lucide-react";
import { business, telHref, whatsappEnquiryHref } from "@/content/business";
import { getCategory } from "@/content/products";
import { liveCatalogueEnabled } from "@/lib/catalogue";
import { useLiveCategory } from "@/lib/live-taxonomy";
import { toDisplayCategory } from "@/lib/taxonomy";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { CategoryVisual } from "./CategoryVisual";
import { OtherCategoryPills } from "./CategoryLinks";
import { LiveCategoryProducts } from "./LiveCategoryProducts";
import { Message, ProductDetailSkeleton } from "./ProductDetail";

/**
 * Live category page: /products/category/?slug=<category-slug>.
 * For categories staff add in the Admin dashboard (the original seven keep
 * their static pages, and their slugs redirect there). Shows only ACTIVE
 * categories; anything else is an honest "not found".
 */
export function LiveCategoryPage() {
  const slug = useSearchParams().get("slug") ?? "";
  const router = useRouter();
  const documented = !!getCategory(slug);
  const { status, category, retry } = useLiveCategory(slug);
  const enabled = liveCatalogueEnabled();

  useEffect(() => {
    if (documented) router.replace(`/products/categories/${slug}/`);
  }, [documented, router, slug]);
  useEffect(() => {
    if (category) document.title = `${category.name} — Products | ${business.shortName}`;
  }, [category]);

  if (documented) return <ProductDetailSkeleton />;
  if (!slug || !enabled || status === "missing") {
    return (
      <Message
        state="not-found"
        icon={<PackageX aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
        title="Category not found"
        text="This category is not listed online, or it is no longer available. Browse our products, or call or WhatsApp the store."
      />
    );
  }
  if (status === "error") {
    return (
      <Message
        state="unavailable"
        icon={<CloudOff aria-hidden="true" className="mx-auto size-10 text-brass-ink" />}
        title="Category temporarily unavailable"
        text="We could not load this category right now. Please try again in a moment, or call or WhatsApp the store."
        onRetry={retry}
      />
    );
  }
  if (!category) return <ProductDetailSkeleton />;

  const display = toDisplayCategory(category);
  return (
    <div data-live-category={category.slug}>
      <PageHero
        crumb={category.name}
        parents={[{ label: "Products", href: "/products/" }]}
        eyebrow="Product category"
        title={category.name}
        intro={category.description ? <p>{category.description}</p> : <p>Ask the store about the items you need.</p>}
        media={
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-[1.75rem] bg-forest-900 shadow-[var(--shadow-lift)] ring-1 ring-white/15 lg:max-w-none">
            <CategoryVisual
              large
              category={display}
              sizes="(min-width: 1440px) 520px, (min-width: 1024px) 36vw, 100vw"
            />
          </div>
        }
      >
        <Button
          href={whatsappEnquiryHref(category.name)}
          external
          variant="gold"
          icon={<WhatsAppIcon />}
          className="!bg-[#177a42] !text-white hover:!bg-[#11653a]"
        >
          Enquire on WhatsApp
        </Button>
        <Button href={telHref} variant="outlineLight" icon={<Phone />}>
          Call {business.phone.display}
        </Button>
      </PageHero>

      <div className="bg-cream pt-16 lg:pt-24">
        <LiveCategoryProducts category={category.slug} title={category.name} />
        {category.productCount === 0 ? (
          <Container size="wide" className="pb-12">
            <p className="rounded-2xl border border-line/70 bg-white p-6 text-ink-muted">
              Individual products in this category are not listed online yet. Call or WhatsApp the store and we will
              confirm what is available.
            </p>
          </Container>
        ) : null}
      </div>

      <section aria-labelledby="other-categories" className="bg-cream pb-16 lg:pb-24">
        <Container size="wide">
          <h2 id="other-categories" className="font-display text-2xl font-medium text-charcoal sm:text-3xl">
            Other categories
          </h2>
          <OtherCategoryPills current={category.slug} className="mt-6 flex flex-wrap gap-3" />
        </Container>
      </section>
    </div>
  );
}
