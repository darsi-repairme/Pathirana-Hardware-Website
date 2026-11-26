/**
 * Tamil and Sinhala translations of the website's own text, keyed by the exact
 * English wording: [Tamil, Sinhala]. A string without an entry is shown in
 * English, so nothing ever renders as a key. "{name}"-style placeholders are
 * filled in by translate() and must appear in all three versions.
 *
 * Proper names (Pathirana Hardware, brand names, Bangadeniya), phone numbers,
 * email addresses, URLs and LKR amounts are not translated.
 *
 * REVIEW: these translations should be checked by a native Tamil and a native
 * Sinhala speaker before launch (see docs/MULTILINGUAL-AND-FEEDBACK.md).
 */
import { about } from "./about.ts";
import { common } from "./common.ts";
import { contact } from "./contact.ts";
import { feedback } from "./feedback.ts";
import { home } from "./home.ts";
import { media } from "./media.ts";
import { offers } from "./offers.ts";
import { pages } from "./pages.ts";
import { products } from "./products.ts";
import { quotation } from "./quotation.ts";
import { services } from "./services.ts";

export type Messages = Record<string, readonly [ta: string, si: string]>;

export const MESSAGE_GROUPS = {
  common,
  home,
  products,
  services,
  about,
  contact,
  quotation,
  feedback,
  pages,
  media,
  offers,
};

export const MESSAGES: Messages = Object.assign({}, ...Object.values(MESSAGE_GROUPS));
