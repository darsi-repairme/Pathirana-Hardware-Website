"use client";

import { Eye } from "lucide-react";
import { whatsappEnquiryHref } from "@/content/business";
import { useLocale } from "@/i18n/I18nProvider";
import { serviceHref, useServiceText, type SiteService } from "@/lib/live-services";
import { Button, ButtonPair } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/**
 * The two actions for a service — View Service (forest green) and Enquire
 * (brass gold, opens WhatsApp with the service name). Same height, width,
 * radius, type size and leading icon size; side by side when there is room,
 * stacked at full width on narrow screens.
 */
export function ServiceActions({
  service,
  className = "",
  tabIndex,
}: {
  service: SiteService;
  className?: string;
  /** -1 for slides that are not currently shown. */
  tabIndex?: number;
}) {
  const { t, locale } = useLocale();
  const title = useServiceText()(service).title;
  return (
    // Compact on phones: side by side from ~340px (labels never wrap), stacked only on the narrowest screens.
    <ButtonPair className={`service-actions [--pair-min:8.5rem] ${className}`}>
      <Button
        href={serviceHref(service)}
        icon={<Eye />}
        ariaLabel={t("View service: {name}", { name: title })}
        tabIndex={tabIndex}
      >
        {t("View Service")}
      </Button>
      <Button
        href={whatsappEnquiryHref(title, locale)}
        external
        variant="gold"
        icon={<WhatsAppIcon />}
        ariaLabel={t("Enquire about {name} on WhatsApp (opens in a new tab)", { name: title })}
        tabIndex={tabIndex}
      >
        {t("Enquire")}
      </Button>
    </ButtonPair>
  );
}
