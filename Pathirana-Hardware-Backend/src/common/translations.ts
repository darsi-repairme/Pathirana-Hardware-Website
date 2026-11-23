import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

/**
 * Staff-entered Tamil (ta) and Sinhala (si) versions of customer-facing text
 * (migration 0006). English stays in the existing columns and is the fallback
 * for every field without a translation. Nothing here is generated or machine
 * translated: only what staff type is stored.
 *
 * PATCH semantics: sending `translations` replaces the whole object, so a
 * cleared field is removed. Empty strings are dropped, never stored.
 */
export const TRANSLATION_LOCALES = ["ta", "si"] as const;
export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number];

class ProductLocaleText {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(300) summary?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  searchTerms?: string[];
}

class CategoryLocaleText {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

class AreaLocaleText {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ProductTranslations {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ProductLocaleText) ta?: ProductLocaleText;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ProductLocaleText) si?: ProductLocaleText;
}

export class CategoryTranslations {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CategoryLocaleText) ta?: CategoryLocaleText;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CategoryLocaleText) si?: CategoryLocaleText;
}

export class AreaTranslations {
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AreaLocaleText) ta?: AreaLocaleText;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AreaLocaleText) si?: AreaLocaleText;
}

type Spec = { line?: readonly string[]; multiline?: readonly string[]; list?: readonly string[] };
export const PRODUCT_TEXT: Spec = {
  line: ["name", "summary"],
  multiline: ["description"],
  list: ["searchTerms"],
};
export const CATEGORY_TEXT: Spec = { line: ["name"], multiline: ["description"] };
export const AREA_TEXT: Spec = { line: ["name"], multiline: ["notes"] };

const line = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").replace(/\s+/g, " ").trim() : "");
const multiline = (v: unknown) =>
  typeof v === "string"
    ? v
        .normalize("NFC")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : "";

export type StoredTranslations = Partial<Record<TranslationLocale, Record<string, string | string[]>>>;

/** Trims (NFC-normalised Unicode), drops empty fields and empty locales. Unknown keys are ignored. */
export function cleanTranslations(input: object | null | undefined, spec: Spec): StoredTranslations {
  const out: StoredTranslations = {};
  if (!input) return out;
  for (const locale of TRANSLATION_LOCALES) {
    const src = (input as Record<string, unknown>)[locale];
    if (!src || typeof src !== "object") continue;
    const fields: Record<string, string | string[]> = {};
    for (const k of spec.line ?? []) {
      const v = line((src as Record<string, unknown>)[k]);
      if (v) fields[k] = v;
    }
    for (const k of spec.multiline ?? []) {
      const v = multiline((src as Record<string, unknown>)[k]);
      if (v) fields[k] = v;
    }
    for (const k of spec.list ?? []) {
      const raw = (src as Record<string, unknown>)[k];
      if (!Array.isArray(raw)) continue;
      const seen = new Set<string>();
      const list = raw.map(line).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
      if (list.length) fields[k] = list;
    }
    if (Object.keys(fields).length) out[locale] = fields;
  }
  return out;
}

/**
 * SQL fragment that matches a LIKE pattern against the translated fields of
 * `alias.translations` (both locales). `$?` is replaced by the caller.
 */
export const translatedTextMatch = (alias: string, fields: readonly string[]) =>
  fields
    .flatMap((f) => TRANSLATION_LOCALES.map((l) => `${alias}.translations->'${l}'->>'${f}' ILIKE $?`))
    .join(" OR ");
