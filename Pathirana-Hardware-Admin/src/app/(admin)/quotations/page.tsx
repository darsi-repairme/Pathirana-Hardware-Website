import type { Metadata } from "next";
import { QUOTATION_STATUSES } from "@/lib/api";
import { QuotationList } from "./QuotationList";

export const metadata: Metadata = { title: "Quotation Requests" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = (await searchParams).status ?? "";
  return <QuotationList initialStatus={(QUOTATION_STATUSES as readonly string[]).includes(s) ? s : ""} />;
}
