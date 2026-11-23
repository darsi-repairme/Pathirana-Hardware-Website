"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { useValidation, type Rules } from "@/lib/useValidation";

type Form = { password: string; confirm: string };
const RULES: Rules<Form> = {
  password: (v) => {
    const s = String(v ?? "");
    if (s.length < 12) return "Use at least 12 characters.";
    if (s.length > 128) return "Use at most 128 characters.";
    if (new Set(s).size < 6) return "This password is too repetitive.";
    return null;
  },
  confirm: (v, all) => (String(v ?? "") === all.password ? null : "The passwords do not match."),
};
const EXPIRED = "This link has expired or has already been used. Ask an admin for a new link.";

/** Checks the one-time link, then lets the person choose their own password (never shown to anyone else). */
export function SetupPasswordForm({ token }: { token: string }) {
  const [link, setLink] = useState<{ fullName: string; purpose: "setup" | "reset" } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ password: "", confirm: "" });
  const v = useValidation(form, RULES);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/setup-password?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as {
          fullName?: string;
          purpose?: "setup" | "reset";
          message?: string;
        };
        if (cancelled) return;
        if (r.ok && body.fullName && body.purpose) setLink({ fullName: body.fullName, purpose: body.purpose });
        else setLinkError(r.status === 410 ? EXPIRED : (body.message ?? EXPIRED));
      })
      .catch(() => {
        if (!cancelled) setLinkError("The server is unavailable. Please try again later.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ph-admin": "1" },
        body: JSON.stringify({ token, password: form.password }),
      });
      if (r.status === 204) {
        setDone(true);
        setForm({ password: "", confirm: "" });
        return;
      }
      const body = (await r.json().catch(() => ({}))) as { message?: string | string[] };
      setError(
        Array.isArray(body.message) ? body.message.join(" ") : (body.message ?? "Your password could not be saved."),
      );
    } catch {
      setError("The server is unavailable. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (done)
    return (
      <div className="mt-6 space-y-4" data-setup-state="done">
        <Alert tone="success">
          Your password has been saved. You can now sign in with your email address and new password.
        </Alert>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-forest font-semibold text-white"
        >
          Go to sign in
        </Link>
      </div>
    );
  if (linkError)
    return (
      <div className="mt-6" data-setup-state="invalid">
        <Alert>{linkError}</Alert>
      </div>
    );
  if (!link)
    return (
      <div className="mt-6">
        <Spinner label="Checking your link…" />
      </div>
    );

  return (
    <form noValidate onSubmit={submit} className="mt-6 space-y-4" data-setup-state="form">
      <p className="text-center text-sm text-ink-muted">
        {link.purpose === "setup" ? "Welcome" : "Hello"}, <strong className="text-charcoal">{link.fullName}</strong>.{" "}
        {link.purpose === "setup" ? "Choose a password for your staff account." : "Choose a new password."}
      </p>
      {error ? <Alert>{error}</Alert> : null}
      <Field
        label="New password"
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
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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
      <Field label="Repeat password" required error={v.error("confirm")}>
        {(p) => (
          <Input
            {...p}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            maxLength={128}
            value={form.confirm}
            onBlur={v.blur("confirm")}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        )}
      </Field>
      <Button type="submit" loading={saving} className="w-full">
        Save Password
      </Button>
    </form>
  );
}
