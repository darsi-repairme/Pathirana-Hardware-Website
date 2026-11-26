import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Browser-tab title for this page (its page.tsx is a client component, which cannot export metadata). */
export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
