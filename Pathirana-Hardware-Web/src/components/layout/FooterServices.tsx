"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { SiteLink } from "@/components/ui/SiteLink";
import { serviceHref, useServiceText, useSiteServices } from "@/lib/live-services";

/**
 * Footer › Our Services — the published services (live from the Admin when the API is set).
 * The list is requested only when the footer comes near the viewport, so ordinary page loads
 * make no API call for it; until then (and without the API) the approved list is shown.
 */
export function FooterServices({ list, link }: { list: string; link: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "300px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const { services } = useSiteServices(!near);
  const text = useServiceText();
  return (
    <ul ref={ref} className={list}>
      {services.map((s) => (
        <li key={s.id}>
          <SiteLink href={serviceHref(s)} className={`group inline-flex items-center gap-2 ${link}`}>
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-gold-soft transition-transform duration-200 group-hover:translate-x-0.5"
            />
            {text(s).shortTitle}
          </SiteLink>
        </li>
      ))}
    </ul>
  );
}
