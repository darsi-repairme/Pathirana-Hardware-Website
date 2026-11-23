import Image from "next/image";

/**
 * Admin-only branding: the clean red/green logo symbol (no embedded company lettering or Sinhala
 * text — a copy of the website's own transparent mark, `public/brand/logo-mark.png`) with
 * "Pathirana Hardware" as real text. The customer website's original logo is not changed.
 *
 *  - tone "light": on the dark-green sidebar; "dark": on cream / white (login, set-password).
 *  - layout "row": symbol beside the name (sidebar); "stack": symbol above the name (forms).
 *  - compact: symbol only (collapsed sidebar); the name stays available to screen readers.
 */
export function AdminBrand({
  tone = "dark",
  layout = "row",
  compact = false,
  subtitle,
  priority = false,
}: {
  tone?: "light" | "dark";
  layout?: "row" | "stack";
  compact?: boolean;
  subtitle?: string;
  priority?: boolean;
}) {
  const stack = layout === "stack";
  return (
    <span
      data-admin-brand
      className={`flex min-w-0 items-center ${stack ? "flex-col text-center" : "gap-3"} ${compact ? "justify-center" : ""}`}
    >
      <Image
        src="/brand/logo-mark.png"
        alt=""
        width={420}
        height={345}
        priority={priority}
        className={`w-auto shrink-0 ${stack ? "h-16 sm:h-[4.5rem]" : "h-9"}`}
      />
      <span className={compact ? "sr-only" : `min-w-0 ${stack ? "mt-4" : ""}`}>
        <span
          className={`block font-display leading-tight font-semibold ${stack ? "whitespace-nowrap" : "[text-wrap:balance]"} ${
            stack ? "text-2xl sm:text-[1.7rem]" : "text-[1.08rem]"
          } ${tone === "light" ? "text-white" : "text-forest"}`}
        >
          Pathirana Hardware
        </span>
        {subtitle ? (
          <span
            className={`mt-1 block text-[0.68rem] font-semibold tracking-[0.24em] uppercase ${
              tone === "light" ? "text-gold-soft" : "text-brass-ink"
            }`}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
