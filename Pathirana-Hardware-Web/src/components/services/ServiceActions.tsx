import { Eye } from "lucide-react";
import { whatsappEnquiryHref } from "@/content/business";
import type { Service } from "@/content/services";
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
  service: Pick<Service, "id" | "title">;
  className?: string;
  /** -1 for slides that are not currently shown. */
  tabIndex?: number;
}) {
  return (
    <ButtonPair className={`[--pair-min:9.75rem] ${className}`}>
      <Button
        href={`/services/${service.id}/`}
        icon={<Eye />}
        ariaLabel={`View service: ${service.title}`}
        tabIndex={tabIndex}
      >
        View Service
      </Button>
      <Button
        href={whatsappEnquiryHref(service.title)}
        external
        variant="gold"
        icon={<WhatsAppIcon />}
        ariaLabel={`Enquire about ${service.title} on WhatsApp (opens in a new tab)`}
        tabIndex={tabIndex}
      >
        Enquire
      </Button>
    </ButtonPair>
  );
}
