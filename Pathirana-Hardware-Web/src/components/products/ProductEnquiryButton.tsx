"use client";

import { useEnquiryHref, useT } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/** "Enquire on WhatsApp" for a documented product type, in the visitor's language. */
export function ProductEnquiryButton({ name, path }: { name: string; path: string }) {
  const t = useT();
  const href = useEnquiryHref()({ name: t(name), price: null, path });
  return (
    <Button href={href} external icon={<WhatsAppIcon />} className="!bg-[#177a42] hover:!bg-[#11653a]">
      {t("Enquire on WhatsApp")}
    </Button>
  );
}
