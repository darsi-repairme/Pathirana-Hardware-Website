import type { Metadata } from "next";
import { business } from "@/content/business";
import { createPageMetadata } from "@/lib/metadata";
import { Hero } from "@/components/home/Hero";
import { FeatureStrip } from "@/components/home/FeatureStrip";
import { AboutPreview } from "@/components/home/AboutPreview";
import { ServicesSection } from "@/components/home/ServicesSection";
import { ProductsSection } from "@/components/home/ProductsSection";
import { PromoBanner } from "@/components/home/PromoBanner";
import { FindStore, GalleryFeedback } from "@/components/home/GalleryLocation";
import { HomeContact } from "@/components/home/HomeContact";
import { DeliveryAreas } from "@/components/home/DeliveryAreas";

export const metadata: Metadata = {
  title: { absolute: `${business.legalName} | Hardware Store in Bangadeniya, Sri Lanka` },
  ...createPageMetadata({
    description: `${business.tagline} ${business.legalName} — hardware and building supplies on Pallama Road, Bangadeniya, Sri Lanka. Call ${business.phone.display} or email us.`,
    path: "/",
  }),
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureStrip />
      <AboutPreview />
      <ServicesSection />
      <ProductsSection />
      <PromoBanner />
      <GalleryFeedback />
      <DeliveryAreas />
      <FindStore />
      <HomeContact />
    </>
  );
}
