"use client";

import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type FormEvent } from "react";
import { CircleCheck, Loader2, MessageSquarePlus, Star, X } from "lucide-react";
import { useLocale } from "@/i18n/I18nProvider";
import {
  FEEDBACK_CONSENT_VERSION,
  FEEDBACK_LIMITS,
  FeedbackSubmitError,
  feedbackEnabled,
  submitFeedback,
  textLength,
  validateFeedback,
} from "@/lib/feedback";

type Field = "name" | "rating" | "message" | "location" | "consent";
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16),
      );

const RATING_WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"] as const;

/**
 * "Share Your Feedback": a button that opens a short form in a native dialog
 * (focus trap, Escape, inert page behind). No account, no contact details.
 * The success message is shown only after the API confirms the feedback was
 * saved; every submission waits for staff approval before it is published.
 */
export function FeedbackButton({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(0);
  if (!feedbackEnabled()) return null;
  const open = () => {
    setMounted((n) => n + 1);
    requestAnimationFrame(() => ref.current?.showModal());
  };
  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold transition-colors duration-200 ${
          tone === "dark"
            ? "bg-brass text-charcoal hover:bg-gold-soft"
            : "border border-forest/25 bg-white text-forest hover:border-brass hover:bg-cream"
        } ${className}`}
      >
        <MessageSquarePlus aria-hidden="true" className="size-5 text-brass-ink" />
        {t("Share Your Feedback")}
      </button>
      <dialog
        ref={ref}
        aria-labelledby="feedback-dialog-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
        className="ph-dialog m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-[var(--radius-card)] border border-line/70 bg-cream p-0 text-charcoal shadow-[var(--shadow-lift)]"
      >
        {mounted ? <FeedbackFormBody key={mounted} onClose={() => ref.current?.close()} /> : null}
      </dialog>
    </>
  );
}

function FeedbackFormBody({ onClose }: { onClose: () => void }) {
  const { t, locale } = useLocale();
  const id = useId();
  const [key, setKey] = useState(newKey);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  // Validation timing: nothing on an untouched form; a field's error shows once it is left (or on
  // Send), then re-checks as the visitor types and clears as soon as the value is valid.
  const [touched, setTouched] = useState<Partial<Record<Field, true>>>({});
  const [submitted, setSubmitted] = useState(false);
  const live = useMemo(
    () => validateFeedback({ name, rating, message, location, consent }),
    [name, rating, message, location, consent],
  );
  const errors: Partial<Record<Field, string>> = Object.fromEntries(
    Object.entries(live).filter(([f]) => submitted || touched[f as Field]),
  );
  const onBlurField = (e: FocusEvent<HTMLFormElement>) => {
    const el = e.target as unknown as HTMLInputElement;
    if (el.type === "checkbox" || el.type === "radio" || !el.id.startsWith(`${id}-`)) return;
    const f = el.id.slice(id.length + 1) as Field;
    if (f in live || ["name", "message", "location"].includes(f)) setTouched((t) => (t[f] ? t : { ...t, [f]: true }));
  };
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    const found = live;
    setSubmitted(true);
    if (Object.keys(found).length) {
      const first = (["name", "rating", "message", "location", "consent"] as const).find((f) => found[f]);
      requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus());
      return;
    }
    setBusy(true);
    try {
      await submitFeedback({
        idempotencyKey: key,
        name: name.trim(),
        rating,
        message: message.trim(),
        ...(location.trim() ? { location: location.trim() } : {}),
        language: locale,
        consent: true,
        consentVersion: FEEDBACK_CONSENT_VERSION,
        ...(website ? { website } : {}),
      });
      setDone(true);
    } catch (err) {
      const d = err instanceof FeedbackSubmitError ? err.detail : ({ kind: "network" } as const);
      if (d.kind === "invalid") {
        const text = d.problems.join(" ");
        setFormError(
          /link/i.test(text)
            ? t("Please remove web links from your feedback.")
            : t("Some details could not be accepted. Please check the form and try again."),
        );
      } else if (d.kind === "conflict") {
        setFormError(t("This form was already sent with different details. Please close it and open a new form."));
        setKey(newKey());
      } else if (d.kind === "rate-limited") {
        setFormError(t("Too many submissions from this connection. Please wait a few minutes and try again."));
      } else if (d.kind === "network") {
        setFormError(t("We could not send your feedback. Please check your internet connection and try again."));
      } else {
        setFormError(t("Something went wrong on our side and your feedback was not saved. Please try again later."));
      }
    } finally {
      setBusy(false);
    }
  };

  const err = (f: Field) =>
    errors[f] ? (
      <p id={`${id}-${f}-error`} className="mt-1.5 text-sm font-semibold text-logo-red">
        {t(errors[f]!)}
      </p>
    ) : null;
  const described = (f: Field, hint?: boolean) =>
    [hint ? `${id}-${f}-hint` : "", errors[f] ? `${id}-${f}-error` : ""].filter(Boolean).join(" ") || undefined;
  const input =
    "w-full rounded-xl border border-line-strong bg-white px-4 text-[0.95rem] text-charcoal outline-none transition-[border-color,box-shadow] hover:border-brass focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.18)] aria-[invalid=true]:border-logo-red";
  const messageLength = textLength(message.trim());

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line/70 bg-cream/95 px-5 py-4 backdrop-blur sm:px-7">
        <h2 id="feedback-dialog-title" className="font-display text-2xl font-semibold text-forest">
          {done ? t("Feedback received") : t("Share Your Feedback")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-cream-deep"
        >
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">{t("Close")}</span>
        </button>
      </div>

      {done ? (
        <div className="px-5 py-8 text-center sm:px-7" role="status">
          <CircleCheck aria-hidden="true" className="mx-auto size-12 text-forest" />
          <h3
            ref={successRef}
            tabIndex={-1}
            className="mt-4 font-display text-xl font-semibold text-charcoal outline-none"
          >
            {t(
              "Thank you for your feedback! Your review has been submitted successfully and will appear on our website after approval.",
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-7 font-semibold text-white hover:bg-forest-800"
          >
            {t("Close")}
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={submit} onBlur={onBlurField} className="space-y-5 px-5 py-6 sm:px-7">
          <p className="text-sm leading-relaxed text-ink-muted">
            {t(
              "Tell us about your experience with Pathirana Hardware. No account or contact details are needed. Your feedback is checked by our team before it is shown on the website.",
            )}
          </p>
          <p className="text-sm text-ink-muted" data-required-note>
            <span aria-hidden="true" className="text-logo-red">
              *
            </span>{" "}
            {t("Fields are required")}
          </p>

          <div>
            <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-semibold text-charcoal">
              {t("Your name (as it will be shown)")} <span className="text-logo-red">*</span>
            </label>
            <input
              id={`${id}-name`}
              autoComplete="given-name"
              maxLength={FEEDBACK_LIMITS.name[1]}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={described("name", true)}
              required
              className={`${input} h-12`}
            />
            <p id={`${id}-name-hint`} className="mt-1.5 text-xs text-ink-muted">
              {t("You can use your first name or initials.")}
            </p>
            {err("name")}
          </div>

          <fieldset aria-describedby={described("rating")}>
            <legend id={`${id}-rating-legend`} className="mb-1.5 text-sm font-semibold text-charcoal">
              {t("Your rating")} <span className="text-logo-red">*</span>
            </legend>
            <div className="flex flex-wrap items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="group relative cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-rating`}
                    id={n === 1 ? `${id}-rating` : undefined}
                    value={n}
                    checked={rating === n}
                    onChange={() => setRating(n)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex size-11 items-center justify-center rounded-full peer-focus-visible:outline-3 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-forest">
                    <Star
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className={`size-8 transition-colors ${
                        n <= rating ? "fill-brass text-brass" : "text-line-strong group-hover:text-brass"
                      }`}
                    />
                  </span>
                  <span className="sr-only">
                    {t("{n} out of 5 stars", { n })} — {t(RATING_WORDS[n - 1]!)}
                  </span>
                </label>
              ))}
              {rating ? (
                <span className="ml-2 text-sm font-semibold text-brass-ink" aria-hidden="true">
                  {t(RATING_WORDS[rating - 1]!)}
                </span>
              ) : null}
            </div>
            {err("rating")}
          </fieldset>

          <div>
            <label htmlFor={`${id}-message`} className="mb-1.5 block text-sm font-semibold text-charcoal">
              {t("Your feedback")} <span className="text-logo-red">*</span>
            </label>
            <textarea
              id={`${id}-message`}
              rows={5}
              maxLength={FEEDBACK_LIMITS.message[1]}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={described("message", true)}
              required
              className={`${input} min-h-32 py-3 leading-relaxed`}
            />
            <p id={`${id}-message-hint`} className="mt-1.5 flex justify-between gap-3 text-xs text-ink-muted">
              <span>{t("Please do not include phone numbers, addresses or web links.")}</span>
              <span className="shrink-0 tabular-nums">
                {messageLength} / {FEEDBACK_LIMITS.message[1]}
              </span>
            </p>
            {err("message")}
          </div>

          <div>
            <label htmlFor={`${id}-location`} className="mb-1.5 block text-sm font-semibold text-charcoal">
              {t("Your town or area (optional)")}
            </label>
            <input
              id={`${id}-location`}
              autoComplete="address-level2"
              maxLength={FEEDBACK_LIMITS.location[1]}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-invalid={errors.location ? true : undefined}
              aria-describedby={described("location", true)}
              className={`${input} h-12`}
            />
            <p id={`${id}-location-hint`} className="mt-1.5 text-xs text-ink-muted">
              {t("A general area only, for example your town. It may be shown with your review.")}
            </p>
            {err("location")}
          </div>

          {/* Honeypot: hidden from people and assistive technology; bots fill it in. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={`${id}-website`}>Website</label>
            <input
              id={`${id}-website`}
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div>
            {/* Mandatory: unchecked by default, never auto-checked; Submit stays disabled until ticked. */}
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-cream/40 p-3 text-sm leading-relaxed text-charcoal has-[:checked]:border-forest has-[:checked]:bg-forest-50">
              <input
                id={`${id}-consent`}
                required
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={described("consent")}
                className="mt-0.5 size-6 shrink-0 accent-forest"
              />
              <span>
                {t(
                  "I agree that Pathirana Hardware may review my feedback and, if approved, publish my review with the display name I provided.",
                )}{" "}
                <span className="text-logo-red">*</span>
              </span>
            </label>
            {err("consent")}
            <p className="mt-2 text-xs text-ink-muted">
              {t("Submitting does not publish your review: our staff check every review first.")}
            </p>
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-xl border border-logo-red/25 bg-white px-4 py-3 text-sm font-semibold text-logo-red"
            >
              {formError}
            </p>
          ) : null}

          {!consent ? (
            <p data-consent-required className="text-sm font-semibold text-brass-ink">
              {t("Tick the agreement box above to submit your feedback.")}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 border-t border-line/70 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-line-strong px-6 font-semibold text-forest hover:border-brass"
            >
              {t("Cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || !consent}
              aria-disabled={busy || !consent}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-forest px-7 font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {busy ? t("Sending…") : t("Submit Feedback")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
