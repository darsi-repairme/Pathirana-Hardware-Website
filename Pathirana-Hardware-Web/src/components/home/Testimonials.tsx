"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Testimonial } from "@/content/testimonials";
import { whatsappChatHref } from "@/content/business";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { HomeEyebrow } from "./HomeEyebrow";

/**
 * "What Our Customers Say" — a typography-led section (large serif quote, gold
 * rules, an oversized quotation mark), deliberately unlike the image-led
 * Gallery above it.
 *
 * Shows only real, approved testimonials from src/content/testimonials.ts.
 * With none, an honest empty state — no names, photos, ratings or quotes are
 * ever invented. Navigation appears only when there are two or more.
 */
export function Testimonials({ items }: { items: readonly Testimonial[] }) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  const t = items[index];
  const go = (d: number) => setIndex((i) => (i + d + count) % count);

  return (
    <section
      aria-labelledby="testimonials-title"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      className="relative isolate overflow-hidden border-y border-line/60 bg-cream-deep/60 py-16 lg:py-24"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 -z-10 -translate-x-1/2 font-display text-[12rem] leading-none text-brass/10 select-none sm:-top-20 sm:text-[16rem]"
      >
        &ldquo;
      </span>
      <Container size="narrow">
        <InView className="reveal-group text-center">
          <div className="rv">
            <HomeEyebrow>Customer voices</HomeEyebrow>
          </div>
          <h2
            id="testimonials-title"
            className="rv d1 mt-4 font-display text-3xl font-semibold text-forest sm:text-[2.4rem]"
          >
            What Our Customers Say
          </h2>

          <div className="rv d2 mx-auto mt-8 max-w-2xl">
            {t ? (
              <figure key={index} className="testimonial-in" aria-live="polite">
                <blockquote className="font-display text-2xl leading-snug text-charcoal italic sm:text-[1.9rem]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center justify-center gap-3 text-sm font-semibold text-brass-ink">
                  <span aria-hidden="true" className="h-px w-8 bg-brass/60" />
                  {t.name}
                  {t.source ? <span className="font-normal text-ink-muted">· {t.source}</span> : null}
                  <span aria-hidden="true" className="h-px w-8 bg-brass/60" />
                </figcaption>
              </figure>
            ) : (
              <>
                <p className="font-display text-xl leading-relaxed text-charcoal/80 italic sm:text-2xl">
                  Customer experiences will be featured here soon.
                </p>
                <p className="mt-4 text-sm text-ink-muted">
                  Shopped with us?{" "}
                  <a
                    href={whatsappChatHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-forest underline-offset-4 hover:underline"
                  >
                    Tell us how it went on WhatsApp
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
              </>
            )}
          </div>

          {count > 1 ? (
            <div className="rv d3 mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => go(-1)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-forest transition-colors hover:border-brass"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
                <span className="sr-only">Previous testimonial</span>
              </button>
              <span className="min-w-12 text-sm text-ink-muted tabular-nums">
                {index + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-forest transition-colors hover:border-brass"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
                <span className="sr-only">Next testimonial</span>
              </button>
            </div>
          ) : null}
        </InView>
      </Container>
    </section>
  );
}
