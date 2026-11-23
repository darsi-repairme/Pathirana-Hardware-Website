import { apiGet, getApiBase } from "./api";

/**
 * Customer feedback (website API, migration 0007). Submissions are saved as
 * "pending" and appear publicly only after staff approve them; the public list
 * contains approved feedback only. Nothing here is invented or edited.
 */
export type FeedbackLanguage = "en" | "ta" | "si";

export type PublicFeedback = {
  id: string;
  name: string;
  rating: number;
  message: string;
  location: string | null;
  language: FeedbackLanguage;
  /** Approval month (YYYY-MM). */
  month: string | null;
};

/** Same limits as the API (src/feedback/feedback.ts). */
export const FEEDBACK_LIMITS = { name: [2, 60], message: [10, 1000], location: [2, 80] } as const;
/** Version of the consent wording shown in the form (stored with each submission). */
export const FEEDBACK_CONSENT_VERSION = "2026-11-20-v2";

export const feedbackEnabled = () => getApiBase() !== null;

export async function fetchApprovedFeedback(signal?: AbortSignal): Promise<PublicFeedback[]> {
  const r = await apiGet<{ items: PublicFeedback[] }>("/api/v1/feedback?limit=12", signal);
  return Array.isArray(r?.items) ? r.items : [];
}

export type FeedbackInput = {
  idempotencyKey: string;
  name: string;
  rating: number;
  message: string;
  location?: string;
  language: FeedbackLanguage;
  consent: boolean;
  consentVersion: string;
  website?: string;
};

export type FeedbackError =
  | { kind: "invalid"; problems: string[] }
  | { kind: "conflict" }
  | { kind: "rate-limited" }
  | { kind: "network" }
  | { kind: "server" };

export class FeedbackSubmitError extends Error {
  constructor(readonly detail: FeedbackError) {
    super(detail.kind);
  }
}

/** Grapheme count, so a Tamil / Sinhala letter with vowel signs counts once (as the API does). */
export function textLength(s: string): number {
  try {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)).length;
  } catch {
    return [...s].length;
  }
}

export const LINK_PATTERN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|lk|xyz|info|biz|ru|io|co|top|site)\b)/i;

/** Field problems as message keys (English text, translated by the form). */
export function validateFeedback(v: {
  name: string;
  rating: number;
  message: string;
  location: string;
  consent: boolean;
}) {
  const e: Partial<Record<"name" | "rating" | "message" | "location" | "consent", string>> = {};
  const name = v.name.trim();
  const message = v.message.trim();
  const location = v.location.trim();
  if (!name) e.name = "Please enter your name.";
  else if (textLength(name) < FEEDBACK_LIMITS.name[0]) e.name = "Your name must be at least 2 characters.";
  else if (name.length > FEEDBACK_LIMITS.name[1]) e.name = "Your name must be 60 characters or fewer.";
  else if (LINK_PATTERN.test(name)) e.name = "Please remove web links.";
  if (!Number.isInteger(v.rating) || v.rating < 1 || v.rating > 5)
    e.rating = "Please choose a rating from 1 to 5 stars.";
  if (!message) e.message = "Please write your feedback.";
  else if (textLength(message) < FEEDBACK_LIMITS.message[0])
    e.message = "Your feedback must be at least 10 characters.";
  else if (message.length > FEEDBACK_LIMITS.message[1]) e.message = "Your feedback must be 1000 characters or fewer.";
  else if (LINK_PATTERN.test(message)) e.message = "Please remove web links from your feedback.";
  if (location && textLength(location) < FEEDBACK_LIMITS.location[0])
    e.location = "Your location must be at least 2 characters.";
  else if (location.length > FEEDBACK_LIMITS.location[1]) e.location = "Your location must be 80 characters or fewer.";
  else if (LINK_PATTERN.test(location)) e.location = "Please remove web links.";
  if (!v.consent) e.consent = "Please tick the box to agree before submitting.";
  return e;
}

/** POST /api/v1/feedback. Resolves only after the API confirms the feedback was saved. */
export async function submitFeedback(input: FeedbackInput): Promise<{ duplicate: boolean }> {
  const base = getApiBase();
  if (!base) throw new FeedbackSubmitError({ kind: "network" });
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new FeedbackSubmitError({ kind: "network" });
  }
  if (res.status === 201 || res.status === 200) {
    const body = (await res.json().catch(() => null)) as { status?: string; duplicate?: boolean } | null;
    if (body?.status !== "pending") throw new FeedbackSubmitError({ kind: "server" });
    return { duplicate: Boolean(body.duplicate) };
  }
  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const m = body?.message;
    throw new FeedbackSubmitError({ kind: "invalid", problems: Array.isArray(m) ? m : m ? [m] : [] });
  }
  if (res.status === 409) throw new FeedbackSubmitError({ kind: "conflict" });
  if (res.status === 429) throw new FeedbackSubmitError({ kind: "rate-limited" });
  throw new FeedbackSubmitError({ kind: "server" });
}
