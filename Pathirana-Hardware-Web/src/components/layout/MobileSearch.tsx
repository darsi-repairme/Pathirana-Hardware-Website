"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { HeaderSearch } from "./HeaderSearch";
import { useT } from "@/i18n/I18nProvider";

/** Search icon that expands a full-width search field under the header (below xl). */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  const t = useT();
  const pathname = usePathname();

  // Close after navigating to another page.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="header-search-panel"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
      >
        {open ? <X aria-hidden="true" className="size-5" /> : <Search aria-hidden="true" className="size-5" />}
        <span className="sr-only">{open ? t("Close search") : t("Search products")}</span>
      </button>
      <div
        id="header-search-panel"
        hidden={!open}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="absolute inset-x-0 top-full border-b border-white/10 bg-forest-900 px-4 py-3 shadow-[0_16px_30px_-18px_rgb(0_0_0/0.7)] sm:px-6"
      >
        {/* Mounted on open so autoFocus moves focus into the field each time. */}
        {open ? (
          <HeaderSearch
            autoFocus
            label="Site (mobile)"
            className="mx-auto max-w-xl"
            onSubmitted={() => setOpen(false)}
          />
        ) : null}
      </div>
    </>
  );
}
