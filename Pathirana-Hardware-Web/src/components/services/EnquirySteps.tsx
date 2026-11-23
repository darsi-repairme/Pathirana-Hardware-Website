"use client";

import type { ReactNode } from "react";
import { translateVars, useT } from "@/i18n/I18nProvider";
import type { Vars } from "@/i18n/translate";
import { business, mailHref, telHref } from "@/content/business";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "How to enquire" — three simple steps (no accounts, forms or online orders).
 * `share` tailors step 2 to a service, e.g. "your order and the delivery location".
 */
export function EnquirySteps({
  id,
  share = "the item, size or specification, the quantity, and when you need it",
  title = "Three simple steps",
  titleVars,
}: {
  id: string;
  share?: string;
  /** English; "{name}" placeholders are filled from titleVars. */
  title?: string;
  titleVars?: Vars;
}) {
  const t = useT();
  const steps: { title: string; body: ReactNode }[] = [
    {
      title: t("Get in touch"),
      body: (
        <>
          {t("Call or WhatsApp")}{" "}
          <a href={telHref} className="font-semibold whitespace-nowrap text-forest hover:text-brass-ink">
            {business.phone.display}
          </a>
          , {t("or email")}{" "}
          <a href={mailHref} className="font-semibold text-forest hover:text-brass-ink">
            {business.email}
          </a>
          .
        </>
      ),
    },
    { title: t("Tell us what you need"), body: t("Share {what}.", { what: t(share) }) },
    {
      title: t("Confirm the details"),
      body: t("The store will confirm availability, prices and any delivery, reservation or bulk-order details."),
    },
  ];
  return (
    // Unboxed: a hairline above, the steps on the page background (no panel).
    <div className="border-t border-line pt-12 lg:pt-16">
      <SectionHeading
        id={id}
        className="reveal mx-auto max-w-2xl"
        align="center"
        eyebrow={t("How to enquire")}
        title={t(title, translateVars(t, titleVars))}
        intro={<p>{t("No accounts or online forms — just call or message the store.")}</p>}
      />
      {/* Centred steps: number badge on top, dashed gold connector to the next badge (md+). */}
      <ol className="mx-auto mt-12 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="reveal relative mx-auto flex w-full max-w-sm flex-col items-center text-center md:max-w-none"
          >
            <span className="relative z-[1] inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-forest font-display text-xl text-gold-soft shadow-[0_14px_30px_-16px_rgb(15_93_58/0.9)]">
              {i + 1}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-7 left-[calc(50%+2.5rem)] hidden h-px w-[calc(100%-5rem+2rem)] bg-[repeating-linear-gradient(to_right,var(--color-brass)_0_6px,transparent_6px_12px)] md:block"
              />
            ) : null}
            <h3 className="mt-6 font-display text-xl font-medium text-charcoal">{step.title}</h3>
            <p className="mt-2 leading-relaxed [overflow-wrap:anywhere] text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
