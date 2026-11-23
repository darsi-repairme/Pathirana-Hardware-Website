import type { Metadata } from "next";
import { Suspense } from "react";
import { business } from "@/content/business";
import { createPageMetadata } from "@/lib/metadata";
import { ProductDetail, ProductDetailSkeleton } from "@/components/products/ProductDetail";

/**
 * Live product page: /products/item/?slug=<product-slug>.
 *
 * The site is a static export, so one stable page loads any PUBLISHED product
 * from the API in the browser — staff can publish products without a rebuild.
 * The documented product-type pages (/products/<type>/) are unchanged.
 */
export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Product",
    description: `Product details from ${business.shortName}, Bangadeniya — call or WhatsApp ${business.phone.display}.`,
    path: "/products/item/",
  }),
  // One shell for every product (content loads in the browser): keep it out of search indexes.
  robots: { index: false, follow: true },
};

export default function ProductItemPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail />
    </Suspense>
  );
}
