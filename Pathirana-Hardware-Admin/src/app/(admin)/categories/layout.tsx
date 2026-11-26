import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Browser-tab title for this page (its page.tsx is a client component, which cannot export metadata). */
export const metadata: Metadata = { title: "Categories" };

export default function CategoriesLayout({ children }: { children: ReactNode }) {
  return children;
}
