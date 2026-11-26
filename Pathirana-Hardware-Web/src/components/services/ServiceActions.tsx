"use client";

import { useLayoutEffect, useRef } from "react";
import { Eye } from "lucide-react";
import { whatsappEnquiryHref } from "@/content/business";
import { useLocale } from "@/i18n/I18nProvider";
import { serviceHref, useServiceText, type SiteService } from "@/lib/live-services";
import { Button, ButtonPair } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/**
 * Sets `--pair-min` on the wrapper to the one-line width of the WIDER of the two buttons, so the
 * pair's grid (`.btn-pair`: auto-fit columns of at least --pair-min) shows two EQUAL columns only
 * when both labels fit on one line, and otherwise stacks them at full width. Re-measured when the
 * language, the fonts or the available width change.
 */
function usePairWidth(dep: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const links = [...el.querySelectorAll<HTMLElement>(".btn-pair > a")];
      if (!links.length) return;
      let need = 0;
      for (const a of links) {
        const prev = a.style.width;
        a.style.width = "max-content";
        need = Math.max(need, a.getBoundingClientRect().width);
        a.style.width = prev;
      }
      el.style.setProperty("--pair-min", `${Math.ceil(need) + 1}px`);
    };
    measure();
    void document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dep]);
  return ref;
}

/**
 * The two actions for a service — View Service (forest green) and Enquire
 * (brass gold, opens WhatsApp with the service name). Same height, width,
 * radius, type size and leading icon size; side by side (equal widths) when
 * both labels fit on one line, otherwise stacked at full width.
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
  const ref = usePairWidth(`${locale}:${title}`);
  return (
    <div ref={ref} className={`service-actions-wrap ${className}`}>
      <ButtonPair className="service-actions">
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
    </div>
  );
}
