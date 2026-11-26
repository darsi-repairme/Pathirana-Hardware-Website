"use client";

import { ExternalLink } from "lucide-react";
import { useWebsiteUrl } from "@/components/AdminShell";

/**
 * "View on website" for a record that is public (published / active): opens the exact page
 * customers see, in a new tab. Renders nothing when WEBSITE_URL is not configured, so the
 * Admin never links to a guessed address.
 */
export function ViewOnWebsite({ path, name }: { path: string; name: string }) {
  const base = useWebsiteUrl();
  if (!base) return null;
  return (
    <a
      href={`${base}${path}`}
      target="_blank"
      rel="noopener noreferrer"
      data-view-on-website
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-line-strong bg-paper px-3.5 text-[0.8125rem] font-semibold whitespace-nowrap text-forest transition-colors duration-200 hover:border-brass hover:bg-cream"
    >
      <ExternalLink aria-hidden="true" className="size-3.5" />
      View on website<span className="sr-only">: {name} (opens in a new tab)</span>
    </a>
  );
}
