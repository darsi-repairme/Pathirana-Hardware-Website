import type { Locale } from "./config.ts";
import { MESSAGES } from "./messages/index.ts";

/** Values substituted into "{name}" placeholders (numbers, names, phone numbers — never translated). */
export type Vars = Record<string, string | number>;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** True when a Tamil / Sinhala version of this English text exists. */
export const hasTranslation = (text: string) => Object.hasOwn(MESSAGES, norm(text));

/**
 * The text in `locale`. English (or any text without a translation) is
 * returned as written, so a visitor never sees a key or an empty string.
 */
export function translate(locale: Locale, text: string, vars?: Vars): string {
  let out = text;
  if (locale !== "en") {
    const entry = MESSAGES[norm(text)];
    const value = entry?.[locale === "ta" ? 0 : 1];
    if (value) out = value;
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return out;
}

export type Translator = (text: string, vars?: Vars) => string;
export const translator =
  (locale: Locale): Translator =>
  (text, vars) =>
    translate(locale, text, vars);
