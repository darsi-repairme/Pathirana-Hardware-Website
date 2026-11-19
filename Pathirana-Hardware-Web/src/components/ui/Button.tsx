import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "gold" | "outline" | "outlineLight" | "light";

const base =
  "group relative inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full px-7 py-3 text-[0.95rem] font-semibold tracking-[0.01em] transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-forest text-white shadow-[0_10px_24px_-14px_rgb(15_93_58/0.9)] hover:bg-forest-800 hover:shadow-[0_18px_34px_-16px_rgb(15_93_58/0.9)]",
  gold: "bg-brass text-charcoal shadow-[0_10px_24px_-14px_rgb(184_134_11/0.9)] hover:bg-gold-soft hover:shadow-[0_18px_34px_-16px_rgb(184_134_11/0.9)]",
  outline: "border border-forest/30 bg-white/60 text-forest hover:border-brass hover:bg-white",
  outlineLight: "on-dark border border-white/35 text-white hover:border-gold-soft hover:bg-white/10",
  light: "on-dark bg-white text-forest hover:bg-cream",
};

type Props = {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  /** Leading icon (Lucide component element). */
  icon?: ReactNode;
  /** Trailing arrow; "external" shows an up-right arrow. */
  arrow?: "right" | "external" | false;
  className?: string;
  /** Opens in a new tab with safe rel attributes. */
  external?: boolean;
  ariaLabel?: string;
  tabIndex?: number;
};

export function Button({
  href,
  children,
  variant = "primary",
  icon,
  arrow = false,
  className = "",
  external = false,
  ariaLabel,
  tabIndex,
}: Props) {
  const classes = `${base} ${variants[variant]} ${className}`;
  const content = (
    <>
      {icon ? (
        <span className="shrink-0 [&>svg]:size-[1.15rem]" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
      {arrow === "right" ? (
        <ArrowRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
        />
      ) : null}
      {arrow === "external" ? (
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
        />
      ) : null}
      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </>
  );

  const isInternal = (href.startsWith("/") || href.startsWith("#")) && !external;
  if (isInternal) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel} tabIndex={tabIndex}>
        {content}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={classes}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {content}
    </a>
  );
}

/**
 * Two related actions with identical dimensions (CEO review #07): stacked at
 * full width on phones; from sm, equal columns sized to the longer label.
 * Children may be Buttons or single-Button wrappers (e.g. reveal wrappers).
 */
export function ButtonPair({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`btn-pair ${className}`}>{children}</div>;
}
