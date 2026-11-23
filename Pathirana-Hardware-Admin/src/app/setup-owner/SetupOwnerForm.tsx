"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { useValidation, type Rules } from "@/lib/useValidation";

type Form = { code: string; fullName: string; email: string; password: string; confirm: string };
const EMPTY: Form = { code: "", fullName: "", email: "", password: "", confirm: "" };
const RULES: Rules<Form> = {
  code: (v) =>
    String(v ?? "").replace(/[\s-]/g, "").length === 16 ? null : "Enter the 16-character code (XXXX-XXXX-XXXX-XXXX).",
  fullName: (v) => (String(v ?? "").trim() ? null : "Enter your full name."),
  email: (v) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v ?? "").trim()) ? null : "Enter a valid email address."),
  password: (v) => {
    const s = String(v ?? "");
    if (s.length < 12) return "Use at least 12 characters.";
    if (s.length > 128) return "Use at most 128 characters.";
    if (new Set(s).size < 6) return "This password is too repetitive.";
    return null;
  },
  confirm: (v, all) => (String(v ?? "") === all.password ? null : "The passwords do not match."),
};
const CLOSED = "Owner registration is closed: an administrator already exists. Please sign in.";

/** Code + Owner details. Errors appear after leaving a field or on submit; success only after the API confirms. */
export function SetupOwnerForm() {
  const [open, setOpen] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const v = useValidation(form, RULES);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ fullName: string; email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/setup-owner", { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { open?: boolean };
        if (cancelled) return;
        if (r.ok && typeof body.open === "boolean") setOpen(body.open);
        else setLoadError("The server is unavailable. Please try again later.");
      })
      .catch(() => !cancelled && setLoadError("The server is unavailable. Please try again later."));
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !v.validateAll()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/setup-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ph-admin": "1" },
        body: JSON.stringify({
          code: form.code,
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirm,
        }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        message?: string | string[];
        fullName?: string;
        email?: string;
      };
      if (r.status === 201) {
        setDone({ fullName: body.fullName ?? form.fullName, email: body.email ?? form.email });
        setForm(EMPTY);
        return;
      }
      if (r.status === 410) {
        setOpen(false);
        return;
      }
      if (r.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.");
        return;
      }
      setError(
        Array.isArray(body.message) ? body.message.join(" ") : (body.message ?? "The account could not be created."),
      );
    } catch {
      setError("The server is unavailable. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (done)
    return (
      <div className="mt-6 space-y-4" data-owner-state="done">
        <Alert tone="success">
          Owner account created for <strong>{done.fullName}</strong> ({done.email}). Owner registration is now closed.
          Sign in with your email address and password.
        </Alert>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-forest font-semibold text-white"
        >
          Go to sign in
        </Link>
      </div>
    );
  if (loadError)
    return (
      <div className="mt-6" data-owner-state="error">
        <Alert>{loadError}</Alert>
      </div>
    );
  if (open === null)
    return (
      <div className="mt-6">
        <Spinner label="Checking…" />
      </div>
    );
  if (!open)
    return (
      <div className="mt-6 space-y-4" data-owner-state="closed">
        <Alert>{CLOSED}</Alert>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-forest font-semibold text-white"
        >
          Go to sign in
        </Link>
      </div>
    );

  return (
    <form noValidate onSubmit={submit} className="mt-6 space-y-4" data-owner-state="form">
      <p className="text-center text-sm text-ink-muted">
        Create the first administrator account. Enter the verification code you were given by the person who set up the
        system.
      </p>
      <p className="text-sm text-ink-muted">
        <span className="text-logo-red">*</span> Fields are required
      </p>
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Verification Code" required hint="16 characters, e.g. ABCD-EFGH-JKMN-PQRS." error={v.error("code")}>
        {(p) => (
          <Input
            {...p}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
            className="font-mono tracking-[0.12em] uppercase"
            value={form.code}
            onBlur={v.blur("code")}
            onChange={set("code")}
          />
        )}
      </Field>
      <Field label="Full Name" required error={v.error("fullName")}>
        {(p) => (
          <Input
            {...p}
            autoComplete="name"
            maxLength={120}
            value={form.fullName}
            onBlur={v.blur("fullName")}
            onChange={set("fullName")}
          />
        )}
      </Field>
      <Field label="Email" required error={v.error("email")}>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            maxLength={254}
            value={form.email}
            onBlur={v.blur("email")}
            onChange={set("email")}
          />
        )}
      </Field>
      <Field
        label="Password"
        required
        hint="At least 12 characters. A short sentence is easy to remember."
        error={v.error("password")}
      >
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              maxLength={128}
              className="pr-12"
              value={form.password}
              onBlur={v.blur("password")}
              onChange={set("password")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-forest hover:bg-cream"
            >
              {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              <span className="sr-only">{show ? "Hide password" : "Show password"}</span>
            </button>
          </div>
        )}
      </Field>
      <Field label="Confirm Password" required error={v.error("confirm")}>
        {(p) => (
          <Input
            {...p}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            maxLength={128}
            value={form.confirm}
            onBlur={v.blur("confirm")}
            onChange={set("confirm")}
          />
        )}
      </Field>
      <Button type="submit" loading={saving} className="w-full">
        Create Owner Account
      </Button>
    </form>
  );
}
