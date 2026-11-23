import { ShieldCheck, Store, Truck, UsersRound, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { T } from "@/i18n/I18nProvider";
import { TRegion } from "@/i18n/I18nProvider";

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: "Quality Products", text: "Durable & reliable" },
  { icon: Truck, title: "Wide Selection", text: "All your building needs" },
  { icon: UsersRound, title: "Expert Support", text: "Friendly & helpful" },
  { icon: Store, title: "Convenient Location", text: "Easy to visit & access" },
];

const delays = ["d1", "d2", "d3", "d4"];

export function FeatureStrip() {
  return (
    <TRegion as="section" label="Why visit us" className="border-b border-line/60 bg-cream">
      <Container size="wide">
        <InView as="div" className="reveal-group">
          {/* Below lg: 2 × 2 with soft gold dividers (feature-grid); from lg the approved row. */}
          <ul className="feature-grid grid grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                className={`rv ${delays[i]} group relative flex items-start gap-3 px-3 py-5 min-[480px]:items-center min-[480px]:gap-4 min-[480px]:px-4 sm:py-6 lg:justify-center lg:py-8 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-brass/30`}
              >
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="size-8 shrink-0 text-brass transition-transform duration-500 group-hover:-translate-y-1 motion-reduce:transition-none min-[480px]:size-10"
                />
                <div>
                  <h2 className="text-[0.95rem] font-semibold text-charcoal max-[479px]:leading-snug min-[480px]:text-base">
                    <T>{title}</T>
                  </h2>
                  <p className="mt-0.5 text-[0.82rem] text-ink-muted max-[479px]:leading-snug min-[480px]:text-sm">
                    <T>{text}</T>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </InView>
      </Container>
    </TRegion>
  );
}
