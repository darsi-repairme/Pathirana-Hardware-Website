import type { Metadata } from "next";
import { ProductList } from "./ProductList";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; deleted?: string; kept?: string }>;
}) {
  const { status: s, deleted, kept } = await searchParams;
  const keptN = Number(kept) || 0;
  const notice = deleted
    ? `“${deleted.slice(0, 160)}” was deleted permanently.${
        keptN ? ` ${keptN} quotation request item${keptN === 1 ? "" : "s"} still show the product name.` : ""
      }`
    : null;
  return <ProductList initialStatus={s === "published" || s === "draft" ? s : ""} initialNotice={notice} />;
}
