/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CUSTOMER FEEDBACK — real, approved testimonials ONLY
 * ─────────────────────────────────────────────────────────────────────────────
 *  Add an entry only when the customer has given permission and the business
 *  has approved the exact wording. Never add example, invented or edited
 *  reviews, names, photos or star ratings.
 *
 *  While this list is empty, the "What Our Customers Say" section is not shown
 *  on the website at all.
 *
 *  Example shape (do NOT publish placeholder text):
 *    { quote: "…exact approved words…", name: "First name L.", source: "Facebook review", date: "2026-03" }
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type Testimonial = {
  /** Exact approved words. */
  quote: string;
  /** Name as the customer agreed to be shown. */
  name: string;
  /** Where the feedback came from, e.g. "Facebook review". */
  source?: string;
  /** ISO year-month, e.g. "2026-03". */
  date?: string;
};

export const testimonials: readonly Testimonial[] = [];
