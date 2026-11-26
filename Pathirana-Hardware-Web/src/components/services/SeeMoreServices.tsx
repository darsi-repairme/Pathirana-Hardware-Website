"use client";

import { LayoutGrid } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";

/** "See More" under the 3D Services sections → /services/all/ (every published service, with photos). */
export function SeeMoreServices({
  variant = "primary",
  className = "",
}: {
  variant?: "primary" | "gold";
  className?: string;
}) {
  const t = useT();
  return (
    <div className={`flex justify-center ${className}`} data-see-more>
      <Button
        href="/services/all/"
        variant={variant}
        icon={<LayoutGrid />}
        arrow="right"
        ariaLabel={t("See more: all services with photos")}
      >
        {t("See More")}
      </Button>
    </div>
  );
}
