import type { Metadata } from "next";
import { DeliveryAreasManager } from "./DeliveryAreasManager";

export const metadata: Metadata = { title: "Delivery Areas" };

export default async function DeliveryAreasPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  return <DeliveryAreasManager openNew={(await searchParams).new === "1"} />;
}
