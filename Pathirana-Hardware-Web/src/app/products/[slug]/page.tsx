import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, ClipboardList, Info, Phone, Tag } from "lucide-react";
import { business, telHref } from "@/content/business";
import { getCategory, getProductType, productTypes, productTypesIn } from "@/content/products";
import { createPageMetadata } from "@/lib/metadata";
import { quotationHref } from "@/lib/quotation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/SectionHeading";
import { EnquiryCta } from "@/components/contact/EnquiryCta";
import { ProductTypeVisual } from "@/components/products/ProductVisual";
import { ProductTypeCard } from "@/components/products/ProductTypeCard";
import { ActiveCategoryGate } from "@/components/products/TaxonomyStates";
import { ProductEnquiryButton } from "@/components/products/ProductEnquiryButton";
import { T } from "@/i18n/I18nProvider";

type Props = { params: Promise<{ slug: string }> };

/** Only the eight documented product types exist; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return productTypes.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProductType((await params).slug);
  if (!product) return {};
  return createPageMetadata({
    title: product.name,
    description: `${product.description} ${business.shortName}, Bangadeniya — call or WhatsApp ${business.phone.display}.`,
    path: `/products/${product.slug}/`,
  });
}

export default async function ProductPage({ params }: Props) {
  const product = getProductType((await params).slug);
  if (!product) notFound();

  const category = getCategory(product.category)!;
  const related = productTypesIn(product.category).filter((p) => p.slug !== product.slug);
  const more = related.length > 0 ? related : productTypes.filter((p) => p.slug !== product.slug).slice(0, 3);
  // Product types show no price → "Contact for Price". The link needs NEXT_PUBLIC_SITE_URL
  // (static build: no browser origin), otherwise the line is left out.
  const path = `/products/${product.slug}/`;

  return (
    <ActiveCategoryGate slug={product.category} what="product">
      <section aria-labelledby="product-title" className="bg-cream pt-6 pb-16 sm:pt-8 lg:pb-24">
        <Container size="wide">
          <Breadcrumbs
            tone="light"
            current={product.name}
            parents={[
              { label: "Products", href: "/products/" },
              { label: category.title, href: `/products/categories/${category.id}/` },
            ]}
          />

          <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-14 land:grid-cols-12 land:gap-8">
            {/* Visual */}
            <div className="hero-enter lg:col-span-6 land:col-span-6">
              <figure className="relative">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-3 translate-y-3 rounded-[var(--radius-panel)] border-2 border-brass/50 sm:translate-x-4 sm:translate-y-4"
                />
                <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] bg-forest-900 shadow-[var(--shadow-lift)]">
                  <ProductTypeVisual
                    product={product}
                    size="lg"
                    preload
                    sizes="(min-width: 1440px) 680px, (min-width: 1024px) 48vw, 100vw"
                  />
                </div>
                {product.image ? (
                  <figcaption className="absolute bottom-4 left-4 rounded-full bg-forest-900/85 px-3 py-1 text-xs font-medium text-cream/90">
                    <T>Illustration — not a specific product</T>
                  </figcaption>
                ) : null}
              </figure>
            </div>

            {/* Details */}
            <div className="hero-enter lg:col-span-6 land:col-span-6">
              <Eyebrow>Product</Eyebrow>
              <h1
                id="product-title"
                className="mt-4 font-display text-[2.6rem] leading-[1.05] font-medium tracking-[-0.01em] text-charcoal sm:text-6xl"
              >
                <T>{product.name}</T>
              </h1>
              <Link
                href={`/products/categories/${category.id}/`}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-forest-50 px-4 text-sm font-semibold text-forest hover:bg-brass-100"
              >
                <Tag aria-hidden="true" className="size-4 text-brass-ink" />
                <T>Category:</T> <T>{category.title}</T>
              </Link>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
                <T>{product.description}</T>
              </p>

              <div className="mt-8 rounded-[var(--radius-card)] border border-line/70 bg-white p-6 shadow-[var(--shadow-card)] sm:p-7">
                <h2 className="text-xs font-semibold tracking-[0.18em] text-brass-ink uppercase">
                  <T>You can ask the store about</T>
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {product.askAbout.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-charcoal">
                      <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-forest" />
                      <T>{item}</T>
                    </li>
                  ))}
                </ul>
                <ButtonPair className="mt-6 border-t border-line/70 pt-6">
                  <ProductEnquiryButton name={product.name} path={path} />
                  <Button href={telHref} variant="outline" icon={<Phone />}>
                    Call Us
                  </Button>
                </ButtonPair>
                <Button
                  href={quotationHref(product.name)}
                  variant="gold"
                  icon={<ClipboardList />}
                  className="mt-3 w-full"
                >
                  Request a Quotation
                </Button>
              </div>

              <p className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brass-ink" />
                <T>
                  This page describes a product type, not a specific item. Prices, sizes and stock are confirmed by the
                  store when you enquire.
                </T>
              </p>
              <Link
                href="/products/"
                className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-forest hover:text-brass-ink"
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> <T>Back to Products</T>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Related */}
      <section aria-labelledby="related-title" className="bg-cream-deep/60 py-16 lg:py-20">
        <Container size="wide">
          <h2 id="related-title" className="reveal font-display text-3xl font-medium text-charcoal sm:text-4xl">
            {related.length > 0 ? <T vars={{ name: category.title }}>{"More in {name}"}</T> : <T>Other products</T>}
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <li key={p.slug} className="reveal">
                <ProductTypeCard product={p} sizes="(min-width: 1024px) 440px, (min-width: 640px) 50vw, 40vw" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <div className="h-16 bg-cream lg:h-24" />
      <EnquiryCta
        id="product-cta-title"
        title="Enquire about {name}"
        titleVars={{ name: product.enquiryName }}
        intro="Send us a WhatsApp message or call the store. We will share the available options and prices."
        enquiry={{ product: { name: product.name, path } }}
      />
    </ActiveCategoryGate>
  );
}
