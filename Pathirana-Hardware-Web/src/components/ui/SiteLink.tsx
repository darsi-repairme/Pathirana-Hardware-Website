"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/**
 * next/link for internal page links (logo, navigation, breadcrumbs).
 *
 * Next.js ignores a click on a link to the page you are already on, so
 * clicking "Home" or the logo while scrolled down the homepage did nothing.
 * Here a same-page click scrolls back to the top (and drops any #hash);
 * links to other pages navigate normally — Next.js then opens the new page
 * at the top (see data-scroll-behavior on <html> in app/layout.tsx).
 */
export function SiteLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname() ?? "/";

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (href.includes("#") || clean(href) !== clean(pathname)) return;
    e.preventDefault();
    if (window.location.hash) window.history.replaceState(window.history.state, "", href);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
