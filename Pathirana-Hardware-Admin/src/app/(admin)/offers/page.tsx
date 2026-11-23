import type { Metadata } from "next";
import { OffersManager } from "./OffersManager";

export const metadata: Metadata = { title: "Offers & Promo Codes" };

export default function OffersPage() {
  return <OffersManager />;
}
