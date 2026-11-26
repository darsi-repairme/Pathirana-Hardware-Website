"use client";

import { useT } from "@/i18n/I18nProvider";
import type { ServicesStatus } from "@/lib/live-services";

/**
 * Shown by the service sections while the live list loads, or when there is nothing to show
 * (no published services, or the API is unreachable). Services come only from the live database.
 */
export function ServicesPending({ status, className = "" }: { status: ServicesStatus; className?: string }) {
  const t = useT();
  if (status === "loading")
    return (
      <p role="status" aria-busy="true" data-services-status="loading" className={`text-ink-muted ${className}`}>
        {t("Loading services…")}
      </p>
    );
  return (
    <p data-services-status={status === "error" ? "unavailable" : "empty"} className={`text-ink-muted ${className}`}>
      {t("Please call or WhatsApp the store to ask about our services.")}
    </p>
  );
}
