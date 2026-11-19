import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardList, MessageCircle, Phone, Send } from "lucide-react";
import { business, telHref } from "@/content/business";
import { images } from "@/lib/images";
import { createPageMetadata } from "@/lib/metadata";
import { BlurredTopBand } from "@/components/ui/BlurredTopBand";
import { Container } from "@/components/ui/Container";
import { QuotationForm } from "@/components/quotation/QuotationForm";

export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Request a Quotation",
    description: `Request a quotation from ${business.shortName}, Bangadeniya: list the products and quantities you need, choose delivery or collection, and send it to us on WhatsApp.`,
    path: "/quotation/",
  }),
};

const steps = [
  { icon: ClipboardList, title: "Tell us what you need", text: "Products, quantities and where you need them." },
  { icon: Send, title: "Save your request", text: "You get a quotation reference number straight away." },
  { icon: MessageCircle, title: "Send it on WhatsApp", text: "Open WhatsApp with the ready message and tap Send." },
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
        intro={<p>Send us your list — we will reply with prices and availability.</p>}
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
            <aside aria-label="How it works" className="lg:col-span-4">
              <div className="rounded-[var(--radius-panel)] bg-forest p-6 text-white shadow-[var(--shadow-card)] sm:p-8 lg:sticky lg:top-28">
                <h2 className="font-display text-2xl font-semibold">How it works</h2>
                <ol className="mt-5 space-y-5">
                  {steps.map(({ icon: Icon, title, text }, i) => (
                    <li key={title} className="flex gap-4">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-gold-soft/60 text-gold-soft">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span>
                        <span className="block font-semibold">
                          {i + 1}. {title}
                        </span>
                        <span className="mt-0.5 block text-sm text-sage">{text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 border-t border-white/15 pt-5 text-sm text-sage">
                  Prefer to talk? Call us and we will help with your list.
                </p>
                <a
                  href={telHref}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-gold-text hover:text-white"
                >
                  <Phone aria-hidden="true" className="size-4" /> {business.phone.display}
                </a>
              </div>
            </aside>
          </div>
        </Container>
      </div>
    </section>
  );
}
