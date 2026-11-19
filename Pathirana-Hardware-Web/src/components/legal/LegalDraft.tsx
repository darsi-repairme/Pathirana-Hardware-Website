import type { ReactNode } from "react";
import { FileWarning } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHero } from "@/components/ui/PageHero";

export type LegalSection = { id: string; heading: string; body: ReactNode };

/**
 * Shared layout for the legal pages (privacy, refund, terms). These are
 * DRAFTS: they state only what the website verifiably does today and mark
 * every unconfirmed point "To be confirmed" for the owner and a legal adviser.
 * The pages are excluded from search indexing until approved.
 */
export function LegalDraft({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <>
      <PageHero crumb={title} eyebrow="Legal" title={title} intro={<p>{intro}</p>} />
      <section aria-label={title} className="bg-cream py-12 lg:py-20">
        <Container size="narrow">
          <div
            role="note"
            className="flex items-start gap-3 rounded-2xl border border-brass/40 bg-brass-100/40 px-5 py-4 text-sm leading-relaxed text-charcoal"
          >
            <FileWarning aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brass-ink" />
            <p>
              <strong className="font-semibold">Draft — awaiting owner and legal review.</strong> This page is not yet
              an approved policy. Items marked <em>To be confirmed</em> will be completed before publication.
            </p>
          </div>

          <div className="mt-10 space-y-10">
            {sections.map((s) => (
              <section key={s.id} aria-labelledby={`legal-${s.id}`}>
                <h2 id={`legal-${s.id}`} className="font-display text-2xl font-semibold text-forest sm:text-[1.7rem]">
                  {s.heading}
                </h2>
                <div className="mt-3 space-y-3 text-[1.02rem] leading-relaxed text-ink-muted [&_a]:font-semibold [&_a]:text-forest [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

/** Inline marker for a point the owner / legal adviser must still confirm. */
export function Tbc({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-brass-100/70 px-1.5 py-0.5 text-[0.95em] text-brass-ink">
      <em>To be confirmed:</em> {children}
    </span>
  );
}
