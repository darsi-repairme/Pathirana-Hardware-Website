import type { Metadata } from "next";
import { business } from "@/content/business";
import { services } from "@/content/services";
import { createPageMetadata } from "@/lib/metadata";
import { LiveServicePage } from "@/components/services/ServiceLive";

type Props = { params: Promise<{ slug: string }> };

/**
 * Pre-built pages exist only for the six approved service slugs (they own the approved 3D scenes);
 * any other slug is a 404 — services added in the Admin use their card on /services/all/.
 * The page content itself comes only from the live database (see LiveServicePage).
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  return createPageMetadata({
    title: "Services",
    description: `Ask ${business.shortName}, Bangadeniya, about this service. Call or WhatsApp ${business.phone.display}.`,
    path: `/services/${slug}/`,
  });
}

export default async function ServicePage({ params }: Props) {
  return <LiveServicePage slug={(await params).slug} />;
}
