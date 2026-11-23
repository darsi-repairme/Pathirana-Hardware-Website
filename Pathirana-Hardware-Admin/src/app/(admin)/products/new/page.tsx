import type { Metadata } from "next";
import { ProductForm } from "@/components/ProductForm";
import { PageHeaderStatic } from "@/components/PageHeaderStatic";

export const metadata: Metadata = { title: "Add Product" };

export default function NewProductPage() {
  return (
    <>
      <PageHeaderStatic
        title="Add Product"
        description="Only real, approved product details. Leave the price as “Contact for Price” until the shop approves one."
        back={{ href: "/products", label: "Products" }}
      />
      <ProductForm />
    </>
  );
}
