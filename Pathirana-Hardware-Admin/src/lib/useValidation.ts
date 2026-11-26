"use client";

import { useCallback, useMemo, useState } from "react";

/** A rule returns a human-readable message when the value is invalid, else null. */
export type Rules<T> = Partial<Record<keyof T, (value: T[keyof T], all: T) => string | null>>;

/**
 * Consistent validation timing for every Admin form:
 *  - nothing is shown on an untouched form, nor while a field is first being typed;
 *  - a field's error appears when the user LEAVES it (blur) with an invalid value;
 *  - once shown, the error re-checks on every edit and disappears as soon as it is fixed;
 *  - Submit checks every field, shows all errors and focuses the first invalid field.
 * The API validates again on every request; this is only the friendly first line.
 */
export function useValidation<T extends Record<string, unknown>>(values: T, rules: Rules<T>) {
  const [touched, setTouched] = useState<Partial<Record<keyof T, true>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const out: Partial<Record<keyof T, string>> = {};
    for (const key of Object.keys(rules) as (keyof T)[]) {
      const msg = rules[key]?.(values[key], values);
      if (msg) out[key] = msg;
    }
    return out;
  }, [values, rules]);

  const error = useCallback(
    (key: keyof T) => (touched[key] || submitted ? errors[key] : undefined),
    [touched, submitted, errors],
  );
  const blur = useCallback((key: keyof T) => () => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), []);

  /** Call on submit: true when valid; otherwise shows every error and focuses the first. */
  const validateAll = useCallback(() => {
    setSubmitted(true);
    const valid = Object.keys(errors).length === 0;
    if (!valid) requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
    return valid;
  }, [errors]);

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  return { error, blur, validateAll, reset, errors };
}

/* ── Shared rules ─────────────────────────────────────────────────────────── */

export const required =
  (label: string) =>
  (v: unknown): string | null =>
    String(v ?? "").trim() ? null : `Enter ${label}.`;

/** Whole numbers 0…max only (no negatives, decimals, exponents or text). */
export const wholeNumber =
  (label: string, max = 9999) =>
  (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    if (!/^\d+$/.test(s)) return `${label} must be a whole number (0 or more).`;
    return Number(s) > max ? `${label} must be ${max} or less.` : null;
  };

export const email = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!s) return "Enter an email address.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : "Enter a valid email address.";
};

/** Keeps only digits when typing or pasting into a whole-number field. */
export const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 4);

/** Today in Sri Lanka as YYYY-MM-DD (business dates are Sri Lanka calendar days). */
export const colomboToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());

/**
 * Future-only date (offer / discount start and end): a date that is set or changed cannot be before
 * today. `original` is the stored value — leaving an older stored date unchanged stays valid (the
 * API applies the same rule).
 */
export const notPast =
  (label: string, original?: string | null) =>
  (v: unknown): string | null => {
    const s = String(v ?? "");
    if (!s || s === (original ?? "")) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return `Enter a valid ${label}.`;
    return s < colomboToday() ? `The ${label} cannot be earlier than today.` : null;
  };
