import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { business, mailHref, mapsHref, mapsIsVerifiedPin, telHref } from "@/content/business";
import { Container } from "@/components/ui/Container";
import { Button, ButtonPair } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/SectionHeading";

type Props = {
  title?: string;
  intro?: string;
};

/** Premium green contact call-to-action panel, shared across pages. */
export function ContactCta({
  title = "Visit Pathirana Hardware",
  intro = "Call ahead to ask about what you need, send us an email, or come and see us on Pallama Road.",
}: Props) {
  const items = [
    {
      icon: Phone,
      label: "Telephone",
      value: business.phone.display,
      sub: business.phone.international,
      href: telHref,
      external: false,
    },
    { icon: Mail, label: "Email", value: business.email, sub: "Email enquiries", href: mailHref, external: false },
    {
      icon: MapPin,
      label: "Location",
      value: `${business.address.street}, ${business.address.locality}`,
      sub: mapsIsVerifiedPin ? "Open in Google Maps" : "Search on Google Maps",
      href: mapsHref,
      external: true,
    },
  ];

  return (
    <section aria-labelledby="contact-cta-title" className="bg-cream pb-20">
      <Container size="wide">
        <div className="on-dark relative isolate overflow-clip rounded-[var(--radius-panel)] bg-forest-900 px-5 py-16 text-white shadow-[var(--shadow-panel)] sm:px-10 lg:px-16 lg:py-20">
          <div
            aria-hidden="true"
            className="absolute -top-40 left-1/3 -z-10 size-[34rem] rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.14),transparent_65%)]"
          />
          <div
            aria-hidden="true"
            className="reveal-line absolute top-0 left-10 h-1 w-40 rounded-b-full bg-gradient-to-r from-brass to-gold-soft"
          />

          <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="reveal lg:col-span-7">
              <Eyebrow tone="dark">Get in touch</Eyebrow>
              <h2
                id="contact-cta-title"
                className="mt-5 font-display text-4xl leading-[1.08] font-medium sm:text-5xl lg:text-[3.5rem]"
              >
                {title}
              </h2>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-sage">{intro}</p>
            </div>
            <ButtonPair className="reveal lg:col-span-5 lg:justify-self-end">
              <Button href={telHref} variant="gold" icon={<Phone />}>
                Call {business.phone.display}
              </Button>
              <Button href={mailHref} variant="outlineLight" icon={<Mail />}>
                Send an email
              </Button>
            </ButtonPair>
          </div>

          <ul className="mt-14 grid gap-4 md:grid-cols-3">
            {items.map(({ icon: Icon, label, value, sub, href, external }) => (
              <li key={label} className="reveal min-w-0">
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex h-full items-start gap-4 rounded-[var(--radius-card)] border border-white/10 bg-white/[0.04] p-6 transition-[background-color,border-color] duration-300 hover:border-gold-soft/40 hover:bg-white/[0.08]"
                >
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold-soft/10 text-gold-soft ring-1 ring-gold-soft/30 transition-colors group-hover:bg-gold-soft group-hover:text-forest-900">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-[0.2em] text-gold-soft uppercase">
                      {label}
                    </span>
                    <span className="mt-1.5 block text-base font-semibold [overflow-wrap:anywhere]">{value}</span>
                    <span className="mt-1 flex items-center gap-1 text-sm text-sage">
                      {sub}
                      {external ? <ArrowUpRight aria-hidden="true" className="size-3.5" /> : null}
                    </span>
                    {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
