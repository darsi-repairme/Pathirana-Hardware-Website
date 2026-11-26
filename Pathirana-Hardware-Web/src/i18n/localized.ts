import type { Locale } from "./config.ts";

/**
 * Staff-entered Tamil / Sinhala versions of dynamic catalogue text (from the
 * API, migration 0006). Missing → the real English value. Never generated.
 */
export type ContentTranslations = Partial<Record<"ta" | "si", Partial<Record<string, string>>>>;

export function localized(
  locale: Locale,
  english: string,
  translations: ContentTranslations | null | undefined,
  field: string,
): string;
export function localized(
  locale: Locale,
  english: string | null,
  translations: ContentTranslations | null | undefined,
  field: string,
): string | null;
export function localized(
  locale: Locale,
  english: string | null,
  translations: ContentTranslations | null | undefined,
  field: string,
): string | null {
  if (locale === "en") return english;
  const v = translations?.[locale]?.[field];
  return typeof v === "string" && v.trim() ? v : english;
}

/** True when the shown value is the staff translation (used for `lang` attributes). */
export const isTranslated = (
  locale: Locale,
  translations: ContentTranslations | null | undefined,
  field: string,
): boolean => locale !== "en" && Boolean(translations?.[locale]?.[field]?.trim());
