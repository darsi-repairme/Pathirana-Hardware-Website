import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquareText, Phone } from "lucide-react";
import { business, telHref } from "@/content/business";
import { getCategory, productCategories, productTypesIn } from "@/content/products";
import { createPageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/PageHero";
import { Container } from "@/components/ui/Container";
import { Button, ButtonPair } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EnquiryCta } from "@/components/contact/EnquiryCta";
import { CategoryIcon, CategoryVisual } from "@/components/products/CategoryVisual";
import { BrandNameTiles, OtherCategoryPills } from "@/components/products/CategoryLinks";
import { ProductTypeCard } from "@/components/products/ProductTypeCard";
import { LiveCategoryProducts } from "@/components/products/LiveCategoryProducts";
import { liveCatalogueEnabled } from "@/lib/catalogue";
import { ActiveCategoryGate } from "@/components/products/TaxonomyStates";
import { WhatsAppSubjectButton } from "@/components/contact/WhatsAppSubjectButton";
import { T } from "@/i18n/I18nProvider";

type Props = { params: Promise<{ slug: string }> };

/** Only the seven documented categories exist; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return productCategories.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategory((await params).slug);
  if (!category) return {};
  return createPageMetadata({
    title: `${category.title} — Products`,
    description: `${category.intro} ${business.shortName}, Bangadeniya — call or WhatsApp ${business.phone.display}.`,
    path: `/products/categories/${category.id}/`,
  });
}

export default async function CategoryPage({ params }: Props) {
  const category = getCategory((await params).slug);
  if (!category) notFound();

  const products = productTypesIn(category.id);
  const isBranded = category.id === "branded-hardware";

  return (
    <ActiveCategoryGate slug={category.id} what="category">
      <PageHero
        crumb={category.title}
        parents={[{ label: "Products", href: "/products/" }]}
        eyebrow="Product category"
        title={category.title}
        intro={
          <p>
            <T>{category.intro}</T>
          </p>
        }
        media={
          <figure className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-forest-900 shadow-[var(--shadow-lift)] ring-1 ring-white/15">
              <CategoryVisual
                large
                category={{
                  slug: category.id,
                  image: category.image ? { kind: "bundled", key: category.image } : null,
                }}
                sizes="(min-width: 1440px) 520px, (min-width: 1024px) 36vw, 100vw"
              />
            </div>
            {category.image ? (
              <figcaption className="absolute bottom-3 left-3 rounded-full bg-forest-900/85 px-3 py-1 text-xs font-medium text-cream/90">
                <T>Illustration</T>
              </figcaption>
            ) : null}
          </figure>
        }
      >
        <WhatsAppSubjectButton subject={category.title} variant="gold" />
        <Button href={telHref} variant="outlineLight" icon={<Phone />}>
          <T vars={{ phone: business.phone.display }}>{"Call {phone}"}</T>
        </Button>
      </PageHero>

      <section aria-labelledby="category-products" className="bg-cream py-16 lg:py-24">
        <Container size="wide">
          <div className="reveal flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              id="category-products"
              className="max-w-2xl"
              eyebrow={<T vars={{ name: category.title }}>{"In {name}"}</T>}
              title={products.length > 0 ? "Products in this category" : "Ask about this category"}
              intro={
                products.length > 0 ? (
                  <p>
                    <T>Select a product for details, or send us an enquiry about the items you need.</T>
                  </p>
                ) : (
                  <p>
                    <T>Individual products in this category are not listed online yet.</T>
                  </p>
                )
              }
            />
            <Link
              href="/products/"
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-forest hover:text-brass-ink"
            >
              <ArrowLeft aria-hidden="true" className="size-4" /> <T>Back to Products</T>
            </Link>
          </div>

          {products.length > 0 ? (
            <ul
              className={`mt-10 grid gap-6 sm:grid-cols-2 ${products.length > 2 ? "lg:grid-cols-3" : "lg:max-w-4xl"}`}
            >
              {products.map((p) => (
                <li key={p.slug} className="reveal">
                  <ProductTypeCard product={p} sizes="(min-width: 1024px) 440px, (min-width: 640px) 50vw, 40vw" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="reveal mt-10 grid gap-8 rounded-[var(--radius-panel)] border border-line/70 bg-white p-7 shadow-[var(--shadow-card)] sm:p-10 lg:grid-cols-12 lg:items-center lg:p-12">
              <div className="lg:col-span-7">
                <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-forest text-gold-soft">
                  <CategoryIcon slug={category.id} strokeWidth={1.6} className="size-6" />
                </span>
                <h3 className="mt-6 font-display text-3xl font-medium text-charcoal">
                  <T>Tell us what you are looking for</T>
                </h3>
                <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-muted">
                  <T>
                    Send the brand, item and quantity you need, and the store will confirm what is available and the
                    current price.
                  </T>
                </p>
                <ButtonPair className="mt-7">
                  <WhatsAppSubjectButton subject={category.title} className="!bg-[#177a42] hover:!bg-[#11653a]" />
                  <Button href={telHref} variant="outline" icon={<Phone />}>
                    <T vars={{ phone: business.phone.display }}>{"Call {phone}"}</T>
                  </Button>
                </ButtonPair>
              </div>
              {isBranded ? (
                <div className="lg:col-span-5">
                  <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-brass-ink uppercase">
                    <MessageSquareText aria-hidden="true" className="size-4" /> <T>Brands you can ask about</T>
                  </p>
                  <BrandNameTiles className="mt-4 grid grid-cols-2 gap-3" />
                  <p className="mt-3 text-xs text-ink-muted">
                    <T>Brand names do not indicate an official partnership.</T>
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </Container>
      </section>

      {/* Published products of this category (live API; hidden while there are none) */}
      {liveCatalogueEnabled() ? <LiveCategoryProducts category={category.id} title={category.title} /> : null}

      {/* Other categories */}
      <section aria-labelledby="other-categories" className="bg-cream pb-16 lg:pb-24">
        <Container size="wide">
          <h2 id="other-categories" className="reveal font-display text-2xl font-medium text-charcoal sm:text-3xl">
            <T>Other categories</T>
          </h2>
          <OtherCategoryPills current={category.id} className="reveal mt-6 flex flex-wrap gap-3" />
        </Container>
      </section>

      <EnquiryCta
        id="category-cta-title"
        title="Need {name}?"
        titleVars={{ name: category.title.toLowerCase() }}
        intro="Tell us the item, size and quantity you need. The store will confirm availability and the current price."
        enquiry={{ subject: category.title }}
      />
    </ActiveCategoryGate>
  );
}
