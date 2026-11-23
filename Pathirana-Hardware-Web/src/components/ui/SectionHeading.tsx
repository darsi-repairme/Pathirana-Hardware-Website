import type { ReactNode } from "react";
import { tx } from "@/i18n/tx";

type Props = {
  /** Small label above the heading, e.g. "About". */
  eyebrow: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
  as?: "h1" | "h2";
  tone?: "light" | "dark";
  align?: "left" | "center";
  className?: string;
  id?: string;
};

export function Eyebrow({
  children,
  tone = "light",
  align = "left",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  const color = tone === "dark" ? "text-gold-text" : "text-brass-ink";
  const line = tone === "dark" ? "bg-gold-soft" : "bg-brass";
  return (
    <p
      className={`flex items-center gap-3 text-xs font-semibold tracking-[0.22em] uppercase ${color} ${
        align === "center" ? "justify-center" : ""
      }`}
    >
      <span aria-hidden="true" className={`h-px w-8 ${line}`} />
      <span>{tx(children)}</span>
      {align === "center" ? <span aria-hidden="true" className={`h-px w-8 ${line}`} /> : null}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  as = "h2",
  tone = "light",
  align = "left",
  className = "",
  id,
}: Props) {
  const Heading = as;
  return (
    <div className={`${align === "center" ? "mx-auto text-center" : ""} ${className}`}>
      <Eyebrow tone={tone} align={align}>
        {eyebrow}
      </Eyebrow>
      <Heading
        id={id}
        className={`mt-4 font-display text-[2.1rem] leading-[1.12] font-medium tracking-[-0.01em] sm:text-[2.8rem] ${
          tone === "dark" ? "text-white" : "text-charcoal"
        }`}
      >
        {tx(title)}
      </Heading>
      {intro ? (
        <div
          className={`mt-5 max-w-2xl text-[1.05rem] leading-relaxed ${align === "center" ? "mx-auto" : ""} ${
            tone === "dark" ? "text-sage" : "text-ink-muted"
          }`}
        >
          {tx(intro)}
        </div>
      ) : null}
    </div>
  );
}
