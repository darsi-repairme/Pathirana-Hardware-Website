"use client";

import { Phone } from "lucide-react";
import { business, telHref, whatsappChatHref, whatsappEnquiryHref } from "@/content/business";
import { translateVars, useEnquiryHref, useLocale } from "@/i18n/I18nProvider";
import type { Vars } from "@/i18n/translate";
import { Container } from "@/components/ui/Container";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

type Props = {
  /** English text (translated here); "{name}" placeholders are filled from `titleVars`. */
  title: string;
  titleVars?: Vars;
  intro: string;
  /**
   * Pre-filled WhatsApp message in the visitor's language: a product (shared product
   * enquiry) or a subject ("Hello Pathirana Hardware, I would like to enquire about …").
   * Without it, a plain chat opens.
   */
  enquiry?: { product: { name: string; path: string } } | { subject: string };
  whatsappLabel?: string;
  eyebrow?: string;
  id?: string;
};

/**
 * Green WhatsApp / Call panel used at the end of the product and service
 * pages. Enquiries only — no ordering, cart or payment.
 */
export function EnquiryCta({
  title,
  intro,
  titleVars,
  enquiry,
  whatsappLabel = "Enquire on WhatsApp",
  eyebrow = "Ask the store",
  id = "enquiry-cta-title",
}: Props) {
  const { t, locale } = useLocale();
  const productHref = useEnquiryHref();
  const whatsappHref = !enquiry
    ? whatsappChatHref
    : "product" in enquiry
      ? productHref({ name: t(enquiry.product.name), price: null, path: enquiry.product.path })
      : whatsappEnquiryHref(t(enquiry.subject), locale);
  return (
    <section aria-labelledby={id} className="bg-cream pb-20">
      <Container size="wide">
        <div className="on-dark relative isolate overflow-clip rounded-[var(--radius-panel)] bg-forest-900 px-6 py-14 text-white shadow-[var(--shadow-panel)] sm:px-12 lg:px-16 lg:py-16">
          <div
            aria-hidden="true"
            className="absolute -right-24 -bottom-48 -z-10 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.16),transparent_65%)]"
          />
          <div
            aria-hidden="true"
            className="reveal-line absolute top-0 left-10 h-1 w-40 rounded-b-full bg-gradient-to-r from-brass to-gold-soft"
          />
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="reveal lg:col-span-7">
              <Eyebrow tone="dark">{t(eyebrow)}</Eyebrow>
              <h2
                id={id}
                className="mt-5 font-display text-[2.1rem] leading-[1.1] font-medium sm:text-5xl lg:text-[3.25rem]"
              >
                {t(title, translateVars(t, titleVars))}
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-sage">{t(intro)}</p>
            </div>
            <ButtonPair className="reveal lg:col-span-5 lg:justify-self-end">
              <Button
                href={whatsappHref}
                external
                variant="gold"
                icon={<WhatsAppIcon />}
                className="!bg-[#177a42] !text-white hover:!bg-[#11653a]"
              >
                {t(whatsappLabel)}
              </Button>
              <Button href={telHref} variant="outlineLight" icon={<Phone />}>
                {t("Call {phone}", { phone: business.phone.display })}
              </Button>
            </ButtonPair>
          </div>
          <p className="reveal mt-10 border-t border-white/10 pt-6 text-sm leading-relaxed text-sage">
            {t(
              "Prices, availability and any delivery, reservation or bulk-order details are confirmed by the store for each enquiry. This website does not take online orders or payments.",
            )}
          </p>
        </div>
      </Container>
    </section>
  );
}
