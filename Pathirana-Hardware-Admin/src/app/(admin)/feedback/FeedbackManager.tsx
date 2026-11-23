"use client";

import { useState } from "react";
import { Check, EyeOff, MessageSquareQuote, RotateCcw, Star, X } from "lucide-react";
import {
  api,
  ApiError,
  FEEDBACK_LANGUAGE_LABEL,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STATUSES,
  qs,
  type Feedback,
  type FeedbackPage,
  type FeedbackStatus,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useStaff } from "@/components/AdminShell";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  PageHeader,
  Pagination,
  Spinner,
  Textarea,
} from "@/components/ui";

const LIMIT = 20;
const TONE: Record<FeedbackStatus, "green" | "gold" | "grey" | "red"> = {
  pending: "gold",
  approved: "green",
  rejected: "red",
  hidden: "grey",
};

type Action = "approve" | "reject" | "hide" | "restore";
const ACTION: Record<Action, { label: string; title: string; message: string; done: string; danger?: boolean }> = {
  approve: {
    label: "Approve",
    title: "Approve and publish?",
    message:
      "This feedback will appear on the website exactly as the customer wrote it (name, rating, message and location).",
    done: "Approved — it now appears on the website.",
  },
  reject: {
    label: "Reject",
    title: "Reject this feedback?",
    message: "It will never be shown on the website. Rejected feedback cannot be approved later.",
    done: "Rejected — it will not be shown on the website.",
    danger: true,
  },
  hide: {
    label: "Hide",
    title: "Hide from the website?",
    message: "It is removed from the website straight away. An administrator can restore it later.",
    done: "Hidden — it no longer appears on the website.",
    danger: true,
  },
  restore: {
    label: "Restore",
    title: "Restore to the website?",
    message: "This previously approved feedback will appear on the website again.",
    done: "Restored — it appears on the website again.",
  },
};
const AVAILABLE: Record<FeedbackStatus, Action[]> = {
  pending: ["approve", "reject"],
  approved: ["hide"],
  hidden: ["restore"],
  rejected: [],
};
const ICON: Record<Action, typeof Check> = { approve: Check, reject: X, hide: EyeOff, restore: RotateCcw };

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(
    new Date(iso),
  );

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`size-4 ${i <= rating ? "fill-brass text-brass" : "text-line-strong"}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

/**
 * Customer Feedback: moderation of website submissions. Nothing is published
 * until a staff member approves it; editors approve, reject and hide;
 * restoring hidden feedback is admin-only (also enforced by the API).
 */
export function FeedbackManager({ initialStatus }: { initialStatus: string }) {
  const staff = useStaff();
  const [status, setStatus] = useState(initialStatus || "pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [pending, setPending] = useState<{ item: Feedback; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const list = useApi<FeedbackPage>(`admin/feedback${qs({ status, page, limit: LIMIT })}`);
  const data = list.data ?? null;
  const counts = data?.statusCounts;

  const canDo = (a: Action) => a !== "restore" || staff.role === "admin";

  const startAction = (item: Feedback, action: Action) => {
    setActionError(null);
    setNote("");
    setPending({ item, action });
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await api.post<Feedback>(
        `admin/feedback/${pending.item.id}/${pending.action}`,
        note.trim() ? { note: note.trim() } : {},
      );
      setNotice(ACTION[pending.action].done);
      if (selected?.id === updated.id) setSelected(updated);
      setPending(null);
      list.reload();
    } catch (e) {
      setActionError(
        e instanceof ApiError && e.status === 409
          ? "This feedback was changed by someone else. The list has been refreshed."
          : (e as Error).message,
      );
      if (e instanceof ApiError && e.status === 409) list.reload();
    } finally {
      setBusy(false);
    }
  };

  const tabs: { value: string; label: string; count?: number }[] = [
    ...FEEDBACK_STATUSES.map((s) => ({ value: s, label: FEEDBACK_STATUS_LABEL[s], count: counts?.[s] })),
    { value: "", label: "All" },
  ];

  const actionButtons = (f: Feedback, size: "sm" | "md" = "sm") =>
    AVAILABLE[f.status].filter(canDo).map((a) => {
      const Icon = ICON[a];
      return (
        <Button
          key={a}
          size={size}
          variant={a === "approve" || a === "restore" ? "primary" : "danger"}
          icon={<Icon aria-hidden="true" className="size-4" />}
          onClick={() => startAction(f, a)}
        >
          {ACTION[a].label}
          <span className="sr-only"> feedback from {f.name}</span>
        </Button>
      );
    });

  return (
    <>
      <PageHeader
        title="Customer Feedback"
        description="Feedback customers sent from the website. Nothing appears on the website until it is approved. Approved feedback is shown exactly as written — it cannot be edited."
      />

      <ul className="mb-5 grid grid-cols-3 gap-3 sm:gap-4">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              aria-pressed={status === s}
              className={`flex w-full flex-col rounded-[var(--radius-card)] border bg-paper p-3 text-left shadow-[var(--shadow-card)] transition-colors sm:p-4 ${
                status === s ? "border-brass" : "border-line/70 hover:border-brass/50"
              }`}
            >
              <span className="font-display text-2xl font-semibold text-forest [font-variant-numeric:lining-nums_tabular-nums] sm:text-3xl">
                {counts ? counts[s] : "–"}
              </span>
              <span className="mt-0.5 text-xs text-ink-muted sm:text-sm">{FEEDBACK_STATUS_LABEL[s]}</span>
            </button>
          </li>
        ))}
      </ul>

      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {list.error ? (
        <div className="mb-4">
          <Alert onRetry={list.reload}>{list.error}</Alert>
        </div>
      ) : null}

      <Card>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2 border-b border-line/70 p-4">
          {tabs.map((t) => (
            <button
              key={t.value || "all"}
              type="button"
              aria-pressed={status === t.value}
              onClick={() => {
                setStatus(t.value);
                setPage(1);
                setNotice(null);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                status === t.value
                  ? "border-forest bg-forest text-white"
                  : "border-line-strong text-forest hover:border-brass"
              }`}
            >
              {t.label}
              {typeof t.count === "number" ? (
                <span className={status === t.value ? "text-gold-soft" : "text-ink-muted"}>{t.count}</span>
              ) : null}
            </button>
          ))}
        </div>

        {list.loading && !list.error ? <Spinner /> : null}
        {!list.loading && data && data.items.length === 0 ? (
          <EmptyState
            icon={<MessageSquareQuote />}
            title={status === "pending" ? "No feedback awaiting review" : "No feedback here"}
          >
            {status === "pending"
              ? "New feedback from the website's Share Your Feedback form appears here for review."
              : "Try another status."}
          </EmptyState>
        ) : null}

        {!list.loading && data && data.items.length ? (
          <ul className="divide-y divide-line/60">
            {data.items.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-charcoal">{f.name}</p>
                    <Stars rating={f.rating} />
                    <Badge tone={TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {formatDateTime(f.submittedAt)}
                    {f.location ? ` · ${f.location}` : ""} · Written in {FEEDBACK_LANGUAGE_LABEL[f.language]}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-charcoal/90">
                    {f.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelected(f)}
                    className="mt-1 text-sm font-semibold text-forest underline-offset-4 hover:underline"
                  >
                    View details<span className="sr-only"> of feedback from {f.name}</span>
                  </button>
                </div>
                <div className="row-actions lg:justify-end">{actionButtons(f)}</div>
              </li>
            ))}
          </ul>
        ) : null}
        {data && data.total > LIMIT ? (
          <div className="border-t border-line/70 p-4">
            <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} />
          </div>
        ) : null}
      </Card>

      {/* Details */}
      <Dialog
        open={Boolean(selected) && !pending}
        title="Feedback details"
        onClose={() => setSelected(null)}
        footer={
          selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              {actionButtons(selected, "md")}
            </>
          ) : null
        }
      >
        {selected ? (
          <dl className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={TONE[selected.status]}>{FEEDBACK_STATUS_LABEL[selected.status]}</Badge>
              <Stars rating={selected.rating} />
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">Name shown</dt>
              <dd className="mt-0.5 font-semibold text-charcoal">{selected.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">Feedback</dt>
              <dd className="mt-0.5 leading-relaxed whitespace-pre-line text-charcoal">{selected.message}</dd>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">Location</dt>
                <dd className="mt-0.5">{selected.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">Language</dt>
                <dd className="mt-0.5">{FEEDBACK_LANGUAGE_LABEL[selected.language]}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">Submitted</dt>
                <dd className="mt-0.5">{formatDateTime(selected.submittedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">Consent</dt>
                <dd className="mt-0.5">
                  {selected.consent ? "Agreed to review and publication" : "—"}{" "}
                  <span className="text-ink-muted">(wording {selected.consentVersion})</span>
                </dd>
              </div>
              {selected.moderatedAt ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">Last reviewed</dt>
                  <dd className="mt-0.5">
                    {formatDateTime(selected.moderatedAt)}
                    {selected.moderatedBy ? ` by ${selected.moderatedBy}` : ""}
                  </dd>
                </div>
              ) : null}
              {selected.note ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
                    Internal note (never public)
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line">{selected.note}</dd>
                </div>
              ) : null}
            </div>
          </dl>
        ) : null}
      </Dialog>

      {/* Confirmation */}
      <Dialog
        open={Boolean(pending)}
        title={pending ? ACTION[pending.action].title : ""}
        onClose={() => !busy && setPending(null)}
        footer={
          pending ? (
            <>
              <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant={ACTION[pending.action].danger ? "danger" : "primary"} onClick={confirm} loading={busy}>
                {ACTION[pending.action].label}
              </Button>
            </>
          ) : null
        }
      >
        {pending ? (
          <div className="space-y-4 text-sm">
            <p className="leading-relaxed text-ink-muted">{ACTION[pending.action].message}</p>
            <blockquote className="rounded-xl border border-line/70 bg-cream/50 px-4 py-3">
              <Stars rating={pending.item.rating} />
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-charcoal">{pending.item.message}</p>
              <footer className="mt-1 text-xs font-semibold text-brass-ink">— {pending.item.name}</footer>
            </blockquote>
            <Field label="Internal note (optional)" hint="Only staff see this. Never shown on the website.">
              {(p) => (
                <Textarea {...p} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              )}
            </Field>
            {actionError ? <Alert>{actionError}</Alert> : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
