"use client";

import Link from "next/link";
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

/* ── Buttons ─────────────────────────────────────────────────────────────── */
type Variant = "primary" | "gold" | "outline" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-forest-800 shadow-[0_8px_18px_-12px_rgb(15_93_58/0.9)]",
  gold: "bg-brass text-charcoal hover:bg-gold-soft shadow-[0_8px_18px_-12px_rgb(184_134_11/0.9)]",
  outline: "border border-line-strong bg-paper text-forest hover:border-brass hover:bg-cream",
  ghost: "text-forest hover:bg-forest-50",
  danger: "border border-logo-red/30 bg-paper text-logo-red hover:bg-danger-50",
};
const sizes = { md: "h-11 px-5 text-sm", sm: "h-9 px-3.5 text-[0.8125rem]" };

type ButtonProps = {
  variant?: Variant;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
} & ComponentProps<"button">;

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-200 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </Link>
  );
}

/* ── Layout pieces ──────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span aria-hidden="true" className="block h-0.5 w-10 bg-brass" />
        <h1 className="mt-3 font-display text-[clamp(1.6rem,4vw,2.1rem)] leading-tight font-semibold text-forest">
          {title}
        </h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-line/70 bg-paper shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

type Tone = "green" | "gold" | "grey" | "red";
const tones: Record<Tone, string> = {
  green: "bg-forest-100 text-forest",
  gold: "bg-brass-100 text-brass-ink",
  grey: "bg-cream-deep text-ink-muted",
  red: "bg-danger-50 text-logo-red",
};
export function Badge({ tone = "grey", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
      <Loader2 aria-hidden="true" className="size-5 animate-spin text-brass" />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-forest-50 text-brass [&>svg]:size-6">
        {icon}
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold text-forest">{title}</h2>
      {children ? <div className="mt-2 max-w-md text-sm text-ink-muted">{children}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
  onRetry,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
  onRetry?: () => void;
}) {
  const style =
    tone === "error"
      ? "border-logo-red/25 bg-danger-50 text-logo-red"
      : tone === "success"
        ? "border-forest/20 bg-forest-50 text-forest"
        : "border-brass/30 bg-brass-100/60 text-brass-ink";
  const Icon = tone === "error" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${style}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" /> Retry
        </button>
      ) : null}
    </div>
  );
}

/* ── Form fields ─────────────────────────────────────────────────────────── */
const control =
  "w-full rounded-xl border border-line-strong bg-paper px-3.5 text-[0.95rem] text-charcoal outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/70 hover:border-brass focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.15)] disabled:bg-cream disabled:text-ink-muted aria-[invalid=true]:border-logo-red";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-charcoal">
        {label}
        {required ? <span className="text-logo-red"> *</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-semibold text-logo-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = ({ className = "", ...p }: ComponentProps<"input">) => (
  <input {...p} className={`${control} h-11 ${className}`} />
);
export const Textarea = ({ className = "", ...p }: ComponentProps<"textarea">) => (
  <textarea {...p} className={`${control} min-h-28 py-2.5 ${className}`} />
);
export const Select = ({ className = "", ...p }: ComponentProps<"select">) => (
  <select {...p} className={`${control} h-11 pr-8 ${className}`} />
);

export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-brass"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className={`${control} h-11 pl-10`}
      />
    </div>
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-line/70 px-4 py-3 text-sm"
    >
      <p className="text-ink-muted">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          icon={<ChevronLeft aria-hidden="true" className="size-4" />}
        >
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

/* ── Dialogs (native <dialog>: focus trap, Escape, inert background) ─────── */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="ph-dialog m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-paper p-0 text-charcoal shadow-[var(--shadow-lift)]"
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          {/* header + footer fixed, body scrolls */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line/70 px-5 py-4">
            <h2 id={titleId} className="font-display text-xl font-semibold text-forest">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted hover:bg-cream"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? (
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line/70 px-5 py-4">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-muted">{message}</div>
    </Dialog>
  );
}

/**
 * Table wrapper: scrolls horizontally inside the card only when unavoidable.
 * `relative` keeps absolutely positioned descendants (e.g. screen-reader-only
 * labels in row buttons) inside the scroll area instead of widening the page.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="relative overflow-x-auto">{children}</div>;
}
export const th =
  "px-4 py-3 text-left text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase whitespace-nowrap";
export const td = "px-4 py-3 align-middle text-sm";
