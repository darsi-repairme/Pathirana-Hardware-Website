import Image from "next/image";
import { Headset, Mail, Phone } from "lucide-react";
import { business, mailHref, telHref, whatsappHref } from "@/content/business";
import { images } from "@/lib/images";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/**
 * Bottom contact band: support icon + short heading · Chat on WhatsApp ·
 * Call Now (the client confirmed both use 071 225 9699). If the WhatsApp
 * number were ever unset, Email Us is offered instead.
 */
export function HomeContact() {
  return (
    <section
      aria-labelledby="home-contact-title"
      className="on-dark relative isolate overflow-hidden bg-forest-900 text-white"
    >
      {/* Desktop (lg+): the full banner photo under an 85% green veil (approved). */}
      <Image
        src={images.ctaBanner.src}
        alt=""
        fill
        quality={90}
        sizes="100vw"
        className="-z-20 object-cover max-lg:hidden"
      />
      {/* Phones/tablets: the wide photo's middle is empty green, so a full-cover
          crop showed nothing. Instead two crops of the SAME photo frame the lower
          corners — the tools (left of the photo) and the helmet (right) — fading
          inwards, under a veil that stays dark behind the text and lifts towards
          the bottom so the artwork shows. */}
      <div
        aria-hidden="true"
        className="contact-art-tools absolute bottom-0 left-0 -z-20 h-[48%] w-[74%] sm:w-[55%] lg:hidden"
      >
        <Image
          src={images.ctaBanner.src}
          alt=""
          fill
          quality={85}
          sizes="74vw"
          className="object-cover object-[0%_55%]"
        />
      </div>
      <div
        aria-hidden="true"
        className="contact-art-helmet absolute right-0 bottom-0 -z-20 h-[48%] w-[50%] sm:w-[38%] lg:hidden"
      >
        <Image
          src={images.ctaBanner.src}
          alt=""
          fill
          quality={85}
          sizes="50vw"
          className="object-cover object-[100%_55%]"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(7_46_29/0.95),rgb(7_46_29/0.9)_42%,rgb(7_46_29/0.45))] lg:bg-forest-900/85 lg:bg-none"
      />
      {/* Slow drifting gold glow (decorative; still for reduced motion). */}
      <div
        aria-hidden="true"
        className="contact-glow pointer-events-none absolute -top-24 left-1/4 -z-10 size-[28rem]"
      />

      <Container size="wide" className="pt-10 pb-8 lg:py-12">
        {/* Phones: heading, then the button pair; from lg one row: heading · pair · line-art. */}
        <InView className="reveal-group grid items-center gap-3 sm:gap-y-7 lg:grid-cols-[1.2fr_auto_minmax(0,0.9fr)] lg:gap-0">
          {/* Below lg the icon aligns with the heading's first line, not the whole text block. */}
          <div className="rv mb-4 flex items-start gap-4 sm:mb-0 lg:items-center lg:pr-10">
            {/* Below lg: centred on the heading's first line. */}
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-gold-soft/50 text-gold-soft max-lg:-mt-2 max-sm:-mt-2.5 sm:size-14">
              <Headset aria-hidden="true" strokeWidth={1.5} className="size-6 sm:size-7" />
            </span>
            <div className="min-w-0">
              <h2
                id="home-contact-title"
                className="font-display text-2xl leading-tight font-semibold sm:text-[1.75rem]"
              >
                Need Help? Get in Touch With Us!
              </h2>
              <p className="mt-1 text-sage">
                Call or WhatsApp us on <span className="whitespace-nowrap">{business.phone.display}</span> about your
                hardware needs.
              </p>
            </div>
          </div>

          {/* WhatsApp + Call: one equal-size pair (stacked on phones, two equal
              columns from sm), separated from the heading by a single rule on lg. */}
          <ButtonPair className="lg:grid-cols-2 lg:border-l lg:border-gold-soft/40 lg:px-10">
            <div className="rv d1">
              {whatsappHref ? (
                <Button
                  href={whatsappHref}
                  external
                  icon={<WhatsAppIcon />}
                  className="!bg-[#177a42] hover:!bg-[#11653a] max-[359px]:px-4"
                >
                  Chat on WhatsApp
                </Button>
              ) : (
                <Button href={mailHref} variant="outlineLight" icon={<Mail />}>
                  Email Us
                </Button>
              )}
            </div>
            <div className="rv d2">
              <Button
                href={telHref}
                variant="gold"
                icon={<Phone />}
                ariaLabel={`Call now: ${business.phone.display}`}
                className="max-[359px]:px-4"
              >
                Call Now · {business.phone.display}
              </Button>
            </div>
          </ButtonPair>

          {/* Gold architectural line-art with a slow shimmer — beside the buttons
              from lg; below them, centred over the photo crops, on smaller screens. */}
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 260 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="line-art-shimmer rv d3 mx-auto mt-5 h-20 w-full max-w-[17rem] text-gold-soft/80 sm:mt-0 sm:max-w-xs lg:mx-0 lg:mt-0 lg:max-w-none lg:text-gold-soft/60"
          >
            <path d="M4 78H256" />
            <path d="M20 78V44H44V78M28 52H36M28 62H36M52 78V26H74V78M58 34H68M58 44H68M58 54H68M58 64H68" />
            <path d="M84 78V48L102 36L120 48V78M96 78V64H108V78" />
            <path d="M130 78V30H152V78M136 38H146M136 48H146M136 58H146M160 78V54H180V78" />
            <path d="M206 78V14M214 78V14M196 14H248M210 14V6L196 14M210 6L248 14M240 14V32" />
          </svg>
        </InView>
      </Container>
    </section>
  );
}
