import Link from "next/link";
import Image from "next/image";
import { Phone } from "lucide-react";
import { business, telHref, whatsappChatHref } from "@/content/business";
import { images } from "@/lib/images";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/**
 * Products page closing banner: a compact, full-width forest-green band over
 * the client's materials banner (materials at both edges, empty green middle).
 * Desktop: heading · short text · WhatsApp + Call; phones: stacked.
 */
export function ProductsCta() {
  return (
    <section
      aria-labelledby="products-cta-title"
      className="on-dark relative isolate overflow-hidden bg-forest-900 text-white"
    >
      <Image
        src={images.productsCtaBanner.src}
        alt=""
        fill
        quality={85}
        sizes="100vw"
        className="-z-20 object-cover object-[0%_50%] lg:object-center"
      />
      {/* Veil: keeps text crisp; the materials at the edges stay visible on desktop. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-forest-900/80 lg:bg-[linear-gradient(to_right,rgb(7_46_29/0.55),rgb(7_46_29/0.88)_22%,rgb(7_46_29/0.88)_78%,rgb(7_46_29/0.55))]"
      />
      <Container size="wide" className="py-10 lg:py-12">
        <div className="reveal grid items-center gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_auto] lg:gap-10">
          <h2
            id="products-cta-title"
            className="font-display text-[clamp(1.6rem,6vw,2.1rem)] leading-tight font-semibold lg:text-[2.1rem]"
          >
            Need a specific product <span className="text-gold-soft">or a bulk order?</span>
          </h2>
          <p className="max-w-md text-sage lg:border-l lg:border-gold-soft/40 lg:pl-8">
            Get in touch with our team and we&apos;ll be happy to assist you.{" "}
            <Link
              href="/quotation/"
              className="font-semibold whitespace-nowrap text-gold-soft underline underline-offset-4 hover:text-white"
            >
              Request a quotation
            </Link>
          </p>
          <ButtonPair className="mt-1 [--pair-min:13rem] lg:mt-0 lg:grid-cols-2">
            <Button
              href={whatsappChatHref}
              external
              icon={<WhatsAppIcon />}
              className="!bg-[#177a42] !text-white hover:!bg-[#11653a]"
            >
              Chat on WhatsApp
            </Button>
            <Button href={telHref} variant="gold" icon={<Phone />} ariaLabel={`Call now: ${business.phone.display}`}>
              Call Now
            </Button>
          </ButtonPair>
        </div>
      </Container>
    </section>
  );
}
