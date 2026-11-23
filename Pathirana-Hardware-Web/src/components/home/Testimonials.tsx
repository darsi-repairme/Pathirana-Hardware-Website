"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { testimonials as approvedStatic } from "@/content/testimonials";
import { LOCALE_META } from "@/i18n/config";
import { useLocale } from "@/i18n/I18nProvider";
import { fetchApprovedFeedback, feedbackEnabled, type FeedbackLanguage, type PublicFeedback } from "@/lib/feedback";
import { whatsappChatHref } from "@/content/business";
import { Container } from "@/components/ui/Container";
import { InView } from "@/components/ui/InView";
import { FeedbackButton } from "./FeedbackForm";
import { HomeEyebrow } from "./HomeEyebrow";

type Item = {
  key: string;
  quote: string;
  name: string;
  rating: number | null;
  location: string | null;
  language: FeedbackLanguage | null;
  source?: string;
};

const LANGUAGE_NAME: Record<FeedbackLanguage, string> = { en: "English", ta: "Tamil", si: "Sinhala" };

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          strokeWidth={1.5}
          className={`size-5 ${i <= rating ? "fill-brass text-brass" : "text-brass/35"}`}
        />
      ))}
    </span>
  );
}

/**
 * "What Our Customers Say" — the typography-led design (large serif quote, gold
 * rules, an oversized quotation mark), now fed by customer feedback that staff
 * APPROVED in the Admin dashboard (plus any approved entries in
 * src/content/testimonials.ts). Pending, rejected and hidden feedback never
 * reaches the website. Reviews are shown exactly as written, in the language the
 * customer used — never translated or edited. With none, an honest empty state.
 */
export function Testimonials() {
  const { t, locale } = useLocale();
  const [live, setLive] = useState<PublicFeedback[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!feedbackEnabled()) return;
    const ctrl = new AbortController();
    fetchApprovedFeedback(ctrl.signal)
      .then(setLive)
      .catch(() => {
        // Unreachable API: show only what is approved in the site content (no error banner on Home).
      });
    return () => ctrl.abort();
  }, []);

  const items: Item[] = [
    ...live.map((f) => ({
      key: f.id,
      quote: f.message,
      name: f.name,
      rating: f.rating,
      location: f.location,
      language: f.language,
    })),
    ...approvedStatic.map((s, i) => ({
      key: `static-${i}`,
      quote: s.quote,
      name: s.name,
      rating: null,
      location: null,
      language: null,
      source: s.source,
    })),
  ];
  const count = items.length;
  const current = items[Math.min(index, Math.max(count - 1, 0))];
  const go = (d: number) => setIndex((i) => (i + d + count) % count);

  return (
    <section
      aria-labelledby="testimonials-title"
      aria-roledescription={count > 1 ? t("carousel") : undefined}
      data-testimonials={count ? "approved" : "empty"}
      className="relative isolate overflow-hidden border-y border-line/60 bg-cream-deep/60 py-16 lg:py-24"
    >
      <Container size="narrow">
        <InView className="reveal-group text-center">
          <div className="rv">
            <HomeEyebrow>Customer voices</HomeEyebrow>
          </div>
          <h2
            id="testimonials-title"
            className="rv d1 mt-4 font-display text-3xl font-semibold text-forest sm:text-[2.4rem]"
          >
            {t("What Our Customers Say")}
          </h2>

          <div className="rv d2 mx-auto mt-8 max-w-2xl">
            {current ? (
              <figure key={current.key} className="testimonial-in" aria-live="polite">
                {current.rating ? (
                  <div className="mb-4 flex justify-center">
                    <Stars rating={current.rating} label={t("{n} out of 5 stars", { n: current.rating })} />
                  </div>
                ) : null}
                <blockquote
                  lang={current.language ? LOCALE_META[current.language].htmlLang : undefined}
                  className="font-display text-2xl leading-snug whitespace-pre-line text-charcoal italic sm:text-[1.9rem]"
                >
                  &ldquo;{current.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-semibold text-brass-ink">
                  <span aria-hidden="true" className="h-px w-8 bg-brass/60" />
                  <span>{current.name}</span>
                  {current.location ? <span className="font-normal text-ink-muted">· {current.location}</span> : null}
                  {current.source ? <span className="font-normal text-ink-muted">· {current.source}</span> : null}
                  <span aria-hidden="true" className="h-px w-8 bg-brass/60" />
                </figcaption>
                {current.language && current.language !== locale ? (
                  <p className="mt-2 text-xs text-ink-muted">
                    {t("Written in {language} by the customer", { language: t(LANGUAGE_NAME[current.language]) })}
                  </p>
                ) : null}
              </figure>
            ) : (
              <>
                <p className="font-display text-xl leading-relaxed text-charcoal/80 italic sm:text-2xl">
                  {t("Customer experiences will be featured here soon.")}
                </p>
                <p className="mt-4 text-sm text-ink-muted">{t("Shopped with us? We would love to hear from you.")}</p>
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
                <span className="sr-only">{t("Previous testimonial")}</span>
              </button>
              <span className="min-w-12 text-sm text-ink-muted tabular-nums">
                {Math.min(index, count - 1) + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                className="inline-flex size-11 items-center justify-center rounded-full border border-line-strong text-forest transition-colors hover:border-brass"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
                <span className="sr-only">{t("Next testimonial")}</span>
              </button>
            </div>
          ) : null}

          <div className="rv d3 mt-8 flex flex-col items-center gap-2">
            <FeedbackButton />
            {feedbackEnabled() ? null : (
              <a
                href={whatsappChatHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
              >
                {t("Tell us how it went on WhatsApp")}
                <span className="sr-only"> {t("(opens in a new tab)")}</span>
              </a>
            )}
            <p className="max-w-md text-xs text-ink-muted">
              {t("Reviews are shown as written by customers, after our team checks them.")}
            </p>
          </div>
        </InView>
      </Container>
    </section>
  );
}
