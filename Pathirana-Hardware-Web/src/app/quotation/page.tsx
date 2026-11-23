import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardList, MessageCircle, Phone, Send } from "lucide-react";
import { business, telHref } from "@/content/business";
import { images } from "@/lib/images";
import { createPageMetadata } from "@/lib/metadata";
import { BlurredTopBand } from "@/components/ui/BlurredTopBand";
import { Container } from "@/components/ui/Container";
import { QuotationForm } from "@/components/quotation/QuotationForm";
import { T, TRegion } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Request a Quotation",
    description: `Request a quotation from ${business.shortName}, Bangadeniya: list the products and quantities you need and choose delivery or collection. Our team will contact you to confirm prices, availability and delivery.`,
    path: "/quotation/",
  }),
};

const steps = [
  { icon: ClipboardList, title: "Tell us what you need", text: "Products, quantities and where you need them." },
  { icon: Send, title: "Submit your request", text: "You get a quotation reference number straight away." },
  {
    icon: MessageCircle,
    title: "We contact you",
    text: "Our team checks prices, stock and delivery, then replies on WhatsApp or by phone. Nothing is ordered or reserved until you agree.",
  },
];

export default function QuotationPage() {
  return (
    <section aria-labelledby="quotation-title">
      <BlurredTopBand
        id="quotation-title"
        image={images.heroMaterials}
        position="object-[50%_55%]"
        crumb="Request a Quotation"
        title="Request a Quotation"
        intro={
          <p>
            <T>Send us your list — we will reply with prices and availability.</T>
          </p>
        }
      />
      <div className="bg-cream pt-10 pb-16 lg:pt-14 lg:pb-24">
        <Container size="wide">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="min-w-0 lg:col-span-8">
              <Suspense
                fallback={<div className="h-[40rem] rounded-[var(--radius-panel)] bg-white/70" aria-hidden="true" />}
              >
                <QuotationForm />
              </Suspense>
            </div>
            <TRegion as="aside" label="How it works" className="lg:col-span-4">
              <div className="rounded-[var(--radius-panel)] bg-forest p-6 text-white shadow-[var(--shadow-card)] sm:p-8 lg:sticky lg:top-28">
                <h2 className="font-display text-2xl font-semibold">
                  <T>How it works</T>
                </h2>
                <ol className="mt-5 space-y-5">
                  {steps.map(({ icon: Icon, title, text }, i) => (
                    <li key={title} className="flex gap-4">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-gold-soft/60 text-gold-soft">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span>
                        <span className="block font-semibold">
                          {i + 1}. <T>{title}</T>
                        </span>
                        <span className="mt-0.5 block text-sm text-sage">
                          <T>{text}</T>
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 border-t border-white/15 pt-5 text-sm text-sage">
                  <T>Prefer to talk? Call us and we will help with your list.</T>
                </p>
                <a
                  href={telHref}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-gold-text hover:text-white"
                >
                  <Phone aria-hidden="true" className="size-4" /> {business.phone.display}
                </a>
              </div>
            </TRegion>
          </div>
        </Container>
      </div>
    </section>
  );
}
