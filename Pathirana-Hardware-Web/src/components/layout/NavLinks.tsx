"use client";

import { SiteLink } from "@/components/ui/SiteLink";
import { usePathname } from "next/navigation";
import { mainNav } from "@/content/navigation";

/** Supporting pages that belong to a main section (Gallery → About Us, FAQ → Contact Us). */
const sectionOf: Record<string, string> = { "/gallery": "/about", "/faq": "/contact" };

export function isActivePath(pathname: string, href: string) {
  const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  const path = clean(pathname);
  if (href === "/") return path === "/";
  const section = Object.entries(sectionOf).find(([page]) => path === page || path.startsWith(`${page}/`))?.[1];
  const target = clean(href);
  return (section ?? path) === target || (section ?? path).startsWith(`${target}/`);
}

/** Desktop navigation with active-page indication. */
export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <ul className="flex items-center gap-0.5 xl:gap-1">
      {mainNav.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <SiteLink
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative inline-flex min-h-11 items-center px-2.5 text-[0.95rem] font-medium transition-colors duration-200 xl:px-3 ${
                active ? "text-gold-soft" : "text-white/85 hover:text-white"
              }`}
            >
              {item.label}
              <span
                aria-hidden="true"
                className={`absolute inset-x-2.5 bottom-1.5 h-0.5 origin-left bg-gold-soft transition-transform duration-300 ease-[var(--ease-out-soft)] motion-reduce:transition-none xl:inset-x-3 ${
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </SiteLink>
          </li>
        );
      })}
    </ul>
  );
}
