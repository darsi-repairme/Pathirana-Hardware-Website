import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { business } from "@/content/business";
import { createPageMetadata } from "@/lib/metadata";
import { Container } from "@/components/ui/Container";
import { BlurredTopBand } from "@/components/ui/BlurredTopBand";
import { images } from "@/lib/images";
import { BrandLogos } from "@/components/products/BrandLogos";
import { CategoryShowcase } from "@/components/products/CategoryShowcase";
import { CatalogueView, ProductCatalogue } from "@/components/products/ProductCatalogue";
import { LiveCatalogue, LiveCatalogueView } from "@/components/products/LiveCatalogue";
import { liveCatalogueEnabled } from "@/lib/catalogue";
import { ProductsCta } from "@/components/products/ProductsCta";
import { T } from "@/i18n/I18nProvider";
import { tx } from "@/i18n/tx";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Products",
    description: `Explore cement, TOR bars, box bars, plywood, doors, windows, bathroom sets, gas cylinders and branded hardware at ${business.shortName}, Bangadeniya. Call or WhatsApp to ask about prices and availability.`,
    path: "/products/",
  }),
};

/** Small centred section heading used on this page (gold rule + serif title). */
function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="reveal text-center">
      <span aria-hidden="true" className="mx-auto block h-0.5 w-12 bg-brass" />
      <h2 id={id} className="mt-4 font-display text-[clamp(1.75rem,5vw,2.4rem)] font-semibold text-forest">
        {tx(children)}
      </h2>
    </div>
  );
}

/**
 * Products page (approved reference layout): Our Products hero · Our Brands ·
 * Browse by Category · search + filters · product listing · contact banner.
 * Global header and footer come from the layout.
 */
export default function ProductsPage() {
  return (
    <>
      {/* 1 · Hero — same photo band as About Us / Services (genuine store aisle, dark veil, breadcrumb). */}
      <section aria-labelledby="products-title">
        <BlurredTopBand
          id="products-title"
          image={images.aisleMaterials}
          position="object-[50%_55%]"
          crumb="Products"
          title="Our Products"
          intro={
            <p>
              <T>A wide range of construction and hardware products for your building needs.</T>
            </p>
          }
        />
      </section>

      {/* 2 · Our Brands — the client's original logo files */}
      <section aria-labelledby="brands-title" className="bg-white py-12 lg:py-16">
        <Container size="wide">
          <Heading id="brands-title">Our Brands</Heading>
          <div className="reveal mx-auto mt-8 max-w-5xl">
            <BrandLogos />
          </div>
          <p className="reveal mx-auto mt-6 flex max-w-3xl items-start justify-center gap-2 text-center text-sm text-ink-muted">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brass-ink" />
            <T>Brand names are shown to help you find products. They do not indicate an official partnership.</T>
          </p>
        </Container>
      </section>

      {/* 3 · Browse by Category */}
      <section aria-labelledby="categories-title" className="bg-cream pt-14 lg:pt-20">
        <Container size="wide">
          <CategoryShowcase heading={<Heading id="categories-title">Browse by Category</Heading>} />
        </Container>
      </section>

      {/* 4 + 5 · Search, filters and product listing */}
      <section
        id="all-products"
        aria-labelledby="all-products-title"
        className="scroll-mt-28 bg-cream pt-14 pb-16 lg:pt-20 lg:pb-24"
      >
        <Container size="wide">
          <h2 id="all-products-title" className="sr-only">
            <T>All products</T>
          </h2>
          {liveCatalogueEnabled() ? (
            // Built with NEXT_PUBLIC_API_URL: published products load from the API in the browser,
            // so newly published products appear without rebuilding the site.
            <Suspense fallback={<LiveCatalogueView urlQuery="" urlCategory="" urlBrand="" />}>
              <LiveCatalogue />
            </Suspense>
          ) : (
            /* No API configured: the documented product types; ?q= / ?category= apply in the browser. */
            <Suspense fallback={<CatalogueView urlQuery="" urlCategory="all" />}>
              <ProductCatalogue />
            </Suspense>
          )}
        </Container>
      </section>

      {/* 6 · Contact banner */}
      <ProductsCta />
    </>
  );
}
