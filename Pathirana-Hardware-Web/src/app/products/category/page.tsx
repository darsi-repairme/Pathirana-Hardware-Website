import type { Metadata } from "next";
import { Suspense } from "react";
import { business } from "@/content/business";
import { createPageMetadata } from "@/lib/metadata";
import { ProductDetailSkeleton } from "@/components/products/ProductDetail";
import { LiveCategoryPage } from "@/components/products/LiveCategoryPage";

/**
 * Live category page: /products/category/?slug=<category-slug>.
 *
 * The site is a static export, so one stable page shows any ACTIVE category
 * staff add in the Admin dashboard (no rebuild). The seven documented
 * categories keep their static pages at /products/categories/<slug>/.
 */
export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Product category",
    description: `Product categories at ${business.shortName}, Bangadeniya — call or WhatsApp ${business.phone.display}.`,
    path: "/products/category/",
  }),
  // One shell for every live category (content loads in the browser): keep it out of search indexes.
  robots: { index: false, follow: true },
};

export default function LiveCategoryRoute() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <LiveCategoryPage />
    </Suspense>
  );
}
