import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/ProductForm";
import { PageHeaderStatic } from "@/components/PageHeaderStatic";

export const metadata: Metadata = { title: "Edit Product" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return (
    <>
      <PageHeaderStatic title="Edit Product" back={{ href: "/products", label: "Products" }} />
      <ProductForm productId={id} created={created} />
    </>
  );
}
