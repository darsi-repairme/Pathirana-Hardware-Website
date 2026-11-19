import type { ReactNode } from "react";
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
}: {
  id: string;
  share?: string;
  title?: string;
}) {
  const steps: { title: string; body: ReactNode }[] = [
    {
      title: "Get in touch",
      body: (
        <>
          Call or WhatsApp{" "}
          <a href={telHref} className="font-semibold whitespace-nowrap text-forest hover:text-brass-ink">
            {business.phone.display}
          </a>
          , or email{" "}
          <a href={mailHref} className="font-semibold text-forest hover:text-brass-ink">
            {business.email}
          </a>
          .
        </>
      ),
    },
    { title: "Tell us what you need", body: `Share ${share}.` },
    {
      title: "Confirm the details",
      body: "The store will confirm availability, prices and any delivery, reservation or bulk-order details.",
    },
  ];
  return (
    // Unboxed: a hairline above, the steps on the page background (no panel).
    <div className="border-t border-line pt-12 lg:pt-16">
      <SectionHeading
        id={id}
        className="reveal max-w-2xl"
        eyebrow="How to enquire"
        title={title}
        intro={<p>No accounts or online forms — just call or message the store.</p>}
      />
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <li key={step.title} className="reveal relative">
            <div className="flex items-center gap-4">
              <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-forest font-display text-xl text-gold-soft shadow-[0_14px_30px_-16px_rgb(15_93_58/0.9)]">
                {i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="hidden h-px flex-1 bg-[repeating-linear-gradient(to_right,var(--color-brass)_0_6px,transparent_6px_12px)] md:block"
                />
              ) : null}
            </div>
            <h3 className="mt-6 font-display text-xl font-medium text-charcoal">{step.title}</h3>
            <p className="mt-2 leading-relaxed [overflow-wrap:anywhere] text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
