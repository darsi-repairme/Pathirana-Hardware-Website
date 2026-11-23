import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Server-rendered page header with a breadcrumb back to the parent list. */
export function PageHeaderStatic({
  title,
  description,
  back,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back ? (
        <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-muted">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href={back.href} className="hover:text-forest">
                {back.label}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="font-semibold text-charcoal">
              {title}
            </li>
          </ol>
        </nav>
      ) : null}
      <span aria-hidden="true" className="block h-0.5 w-10 bg-brass" />
      <h1 className="mt-3 font-display text-[clamp(1.6rem,4vw,2.1rem)] leading-tight font-semibold text-forest">
        {title}
      </h1>
      {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
    </div>
  );
}
