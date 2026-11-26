"use client";

import { useId, useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { Field, Input, Textarea } from "@/components/ui";

export type TranslationLocale = "ta" | "si";
/** Form state: plain strings per locale and field ("" = not translated). */
export type TranslationForm = Record<TranslationLocale, Record<string, string>>;

export const LOCALES: { code: TranslationLocale; label: string; native: string; lang: string }[] = [
  { code: "ta", label: "Tamil", native: "தமிழ்", lang: "ta-LK" },
  { code: "si", label: "Sinhala", native: "සිංහල", lang: "si-LK" },
];

export type TranslationFieldSpec = {
  key: string;
  label: string;
  /** The current English text, shown for reference. */
  english: string;
  multiline?: boolean;
  maxLength: number;
  hint?: string;
};

export const emptyTranslationForm = (): TranslationForm => ({ ta: {}, si: {} });

/** API value → form state (lists become comma-separated text). */
export function toTranslationForm(value: unknown): TranslationForm {
  const out = emptyTranslationForm();
  if (!value || typeof value !== "object") return out;
  for (const { code } of LOCALES) {
    const src = (value as Record<string, unknown>)[code];
    if (!src || typeof src !== "object") continue;
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (typeof v === "string") out[code][k] = v;
      else if (Array.isArray(v)) out[code][k] = v.filter((x) => typeof x === "string").join(", ");
    }
  }
  return out;
}

/** Form state → API value. `lists` are split on commas. Empty fields are left out. */
export function fromTranslationForm(form: TranslationForm, lists: readonly string[] = []) {
  const out: Record<string, Record<string, string | string[]>> = {};
  for (const { code } of LOCALES) {
    const fields: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(form[code])) {
      const t = v.trim();
      if (!t) continue;
      fields[k] = lists.includes(k)
        ? t
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : t;
    }
    if (Object.keys(fields).length) out[code] = fields;
  }
  return out;
}

const filledCount = (form: TranslationForm, code: TranslationLocale) =>
  Object.values(form[code]).filter((v) => v.trim()).length;

/**
 * "Website languages": Tamil and Sinhala versions of customer-facing text.
 * Staff type their own translations; anything left empty shows the English
 * text on the website. Nothing is machine-translated.
 */
export function TranslationFields({
  fields,
  value,
  onChange,
  disabled,
}: {
  fields: TranslationFieldSpec[];
  value: TranslationForm;
  onChange: (next: TranslationForm) => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<TranslationLocale>("ta");
  const baseId = useId();
  const locale = LOCALES.find((l) => l.code === tab)!;
  const set = (key: string, v: string) => onChange({ ...value, [tab]: { ...value[tab], [key]: v } });
  const total = filledCount(value, "ta") + filledCount(value, "si");
  // Collapsed until needed; opened straight away when this record already has translations.
  const [open, setOpen] = useState(total > 0);

  return (
    <section aria-labelledby={`${baseId}-t`} className="rounded-2xl border border-line/70 bg-cream/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${baseId}-t`} className="flex items-center gap-2 font-semibold text-forest">
            <Languages aria-hidden="true" className="size-4 text-brass" /> Website languages
          </h3>
          <p className="mt-1 max-w-xl text-xs text-ink-muted">
            Optional Tamil and Sinhala text for customers who choose those languages. Leave a field empty to show the
            English text. Type or paste your own approved wording — nothing is translated automatically.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${baseId}-body`}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3.5 text-sm font-semibold text-forest hover:border-brass"
        >
          {open ? "Hide translations" : total ? `Edit translations (${total})` : "Add Tamil / Sinhala text"}
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open ? (
        <div id={`${baseId}-body`} className="mt-4">
          <div
            role="tablist"
            aria-label="Language"
            className="grid w-full grid-cols-2 rounded-2xl border border-line-strong p-0.5 sm:inline-grid sm:w-auto sm:rounded-full"
          >
            {LOCALES.map((l) => {
              const n = filledCount(value, l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${l.code}`}
                  aria-selected={tab === l.code}
                  aria-controls={`${baseId}-panel`}
                  onClick={() => setTab(l.code)}
                  className={`inline-flex min-h-9 flex-wrap items-center justify-center gap-x-1.5 rounded-xl px-2 text-sm font-semibold transition-colors sm:rounded-full sm:px-3.5 ${
                    tab === l.code ? "bg-forest text-white" : "text-forest hover:bg-forest-50"
                  }`}
                >
                  {l.label} <span lang={l.lang}>({l.native})</span>
                  <span className={`text-xs ${tab === l.code ? "text-gold-soft" : "text-ink-muted"}`}>
                    {n}/{fields.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab}`}
            className="mt-4 grid gap-4"
            lang={locale.lang}
          >
            {fields.map((f) => (
              <div key={`${tab}-${f.key}`} className="grid gap-1.5">
                <Field
                  label={`${f.label} — ${locale.label}`}
                  hint={
                    <span lang="en">
                      {f.hint ? `${f.hint} ` : ""}English:{" "}
                      {f.english.trim() ? `“${truncate(f.english, 140)}”` : "(empty)"}
                    </span>
                  }
                >
                  {(p) =>
                    f.multiline ? (
                      <Textarea
                        {...p}
                        rows={4}
                        maxLength={f.maxLength}
                        value={value[tab][f.key] ?? ""}
                        disabled={disabled}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="leading-relaxed"
                      />
                    ) : (
                      <Input
                        {...p}
                        maxLength={f.maxLength}
                        value={value[tab][f.key] ?? ""}
                        disabled={disabled}
                        onChange={(e) => set(f.key, e.target.value)}
                      />
                    )
                  }
                </Field>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
