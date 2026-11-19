import Link from "next/link";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href: string };

/**
 * Breadcrumb trail: Home › parents › current page.
 * `tone="dark"` for green panels, `"light"` for cream pages.
 */
export function Breadcrumbs({
  current,
  parents = [],
  tone = "dark",
  className = "",
}: {
  current: string;
  parents?: readonly Crumb[];
  tone?: "dark" | "light";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <nav aria-label="Breadcrumb" className={`text-sm ${dark ? "text-sage" : "text-ink-muted"} ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {[{ label: "Home", href: "/" }, ...parents].map((p) => (
          <Fragment key={p.href}>
            <li>
              <Link
                href={p.href}
                className={`link-underline inline-flex min-h-6 items-center ${dark ? "hover:text-white" : "hover:text-forest"}`}
              >
                {p.label}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5" />
            </li>
          </Fragment>
        ))}
        <li aria-current="page" className={`font-medium ${dark ? "text-white" : "text-charcoal"}`}>
          {current}
        </li>
      </ol>
    </nav>
  );
}
