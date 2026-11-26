import type { Metadata } from "next";
import { ProductList } from "./ProductList";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    deleted?: string;
    kept?: string;
    created?: string;
    saved?: string;
    publishFailed?: string;
    q?: string;
  }>;
}) {
  const { status: s, deleted, kept, created, saved, publishFailed, q } = await searchParams;
  const keptN = Number(kept) || 0;
  const notice = deleted
    ? `“${deleted.slice(0, 160)}” was deleted permanently.${
        keptN ? ` ${keptN} quotation request item${keptN === 1 ? "" : "s"} still show the product name.` : ""
      }`
    : created
      ? publishFailed
        ? `Product “${created.slice(0, 160)}” added as a draft, but it could not be published. Open it below and publish it again.`
        : `Product “${created.slice(0, 160)}” added successfully. It is listed below.`
      : saved
        ? `Product changes to “${saved.slice(0, 160)}” saved successfully.`
        : null;
  return (
    <ProductList
      initialStatus={s === "published" || s === "draft" ? s : ""}
      initialNotice={notice}
      initialQuery={(q ?? "").slice(0, 80)}
    />
  );
}
