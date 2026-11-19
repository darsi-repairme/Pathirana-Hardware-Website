"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: typeof fieldErrors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) fe.email = "Enter a valid email address.";
    if (!password) fe.password = "Enter your password.";
    setFieldErrors(fe);
    setError(null);
    if (fe.email || fe.password) return;

    setBusy(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ph-admin": "1" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Sign-in failed. Please try again.");
        setPassword("");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-4">
      {notice && !error ? <Alert tone="info">{notice}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Email" error={fieldErrors.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        )}
      </Field>
      <Field label="Password" error={fieldErrors.password}>
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-pressed={show}
              className="absolute top-1/2 right-1.5 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-cream hover:text-forest"
            >
              {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              <span className="sr-only">{show ? "Hide password" : "Show password"}</span>
            </button>
          </div>
        )}
      </Field>
      <Button type="submit" loading={busy} icon={<LogIn aria-hidden="true" className="size-4" />} className="w-full">
        {busy ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
