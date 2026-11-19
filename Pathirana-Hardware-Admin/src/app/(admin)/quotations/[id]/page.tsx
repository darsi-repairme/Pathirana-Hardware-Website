import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeaderStatic } from "@/components/PageHeaderStatic";
import { QuotationDetailView } from "./QuotationDetailView";

export const metadata: Metadata = { title: "Quotation Request" };

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return (
    <>
      <PageHeaderStatic title="Quotation Request" back={{ href: "/quotations", label: "Quotation Requests" }} />
      <QuotationDetailView id={id} />
    </>
  );
}
