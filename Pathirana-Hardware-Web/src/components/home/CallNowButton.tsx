"use client";

import { Phone } from "lucide-react";
import { business, telHref } from "@/content/business";
import { useT } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";

/** "Call Now · 071 225 9699" with a translated accessible name ("Call now: 071 225 9699"). */
export function CallNowButton({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <Button
      href={telHref}
      variant="gold"
      icon={<Phone />}
      ariaLabel={t("Call now: {phone}", { phone: business.phone.display })}
      className={className}
    >
      {`${t("Call Now")} · ${business.phone.display}`}
    </Button>
  );
}
