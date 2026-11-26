import type { Metadata } from "next";
import { ServicesManager } from "./ServicesManager";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return <ServicesManager />;
}
