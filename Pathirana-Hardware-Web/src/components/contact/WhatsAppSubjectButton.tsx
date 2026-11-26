"use client";

import type { ComponentProps } from "react";
import { whatsappEnquiryHref } from "@/content/business";
import { useLocale } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/**
 * WhatsApp button with the pre-filled "I would like to enquire about …" message
 * in the visitor's language (the subject is translated when the site knows it).
 */
export function WhatsAppSubjectButton({
  subject,
  label = "Enquire on WhatsApp",
  variant,
  className = "!bg-[#177a42] !text-white hover:!bg-[#11653a]",
}: {
  subject: string;
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const { t, locale } = useLocale();
  return (
    <Button
      href={whatsappEnquiryHref(t(subject), locale)}
      external
      variant={variant}
      icon={<WhatsAppIcon />}
      className={className}
    >
      {t(label)}
    </Button>
  );
}
