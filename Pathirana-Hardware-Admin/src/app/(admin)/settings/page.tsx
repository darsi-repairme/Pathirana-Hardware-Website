"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KeyRound, LogOut, UserRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStaff } from "@/components/AdminShell";
import { Alert, Button, Card, Field, Input, PageHeader } from "@/components/ui";

/**
 * Settings that genuinely exist: your account details, changing your own
 * password, and signing out of every device.
 */
export default function SettingsPage() {
  const me = useStaff();
  const router = useRouter();
  const toLogin = () => {
    router.replace("/login?signedOut=1");
    router.refresh();
  };
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const change = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.next !== form.confirm) return setError(new ApiError(400, "The new passwords do not match."));
    setSaving(true);
    try {
      await api.post("auth/password", { currentPassword: form.current, newPassword: form.next });
      // Every session (including this one) has ended on the API: sign in again.
      await fetch("/api/session", { method: "DELETE", headers: { "x-ph-admin": "1" } });
      toLogin();
    } catch (err) {
      setError(err as ApiError);
      setSaving(false);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);
    await fetch("/api/session", { method: "DELETE", headers: { "x-ph-admin": "1" } }).catch(() => {});
    toLogin();
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account and sign-in security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
            <UserRound aria-hidden="true" className="size-5 text-brass" /> Your account
          </h2>
          <dl className="mt-4 divide-y divide-line/60 text-sm">
            {[
              ["Name", me.fullName],
              ["Email", me.email],
              [
                "Role",
                me.role === "admin"
                  ? "Admin — everything, including staff accounts"
                  : "Editor — catalogue, delivery areas and quotation requests",
              ],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-semibold [overflow-wrap:anywhere] text-charcoal">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 border-t border-line/70 pt-5">
            <h3 className="font-semibold text-charcoal">Sign out everywhere</h3>
            <p className="mt-1 text-sm text-ink-muted">Ends your sessions on all devices, including this one.</p>
            <Button
              variant="outline"
              className="mt-3"
              loading={signingOut}
              onClick={signOutEverywhere}
              icon={<LogOut aria-hidden="true" className="size-4" />}
            >
              Sign Out Everywhere
            </Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
            <KeyRound aria-hidden="true" className="size-5 text-brass" /> Change password
          </h2>
          <form onSubmit={change} className="mt-4 space-y-4">
            {error ? (
              <Alert>
                {error.message}
                {error.details.length ? (
                  <ul className="mt-1 list-disc pl-4">
                    {error.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}
            <Field label="Current password" required>
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  required
                  autoComplete="current-password"
                  value={form.current}
                  onChange={(e) => setForm({ ...form, current: e.target.value })}
                />
              )}
            </Field>
            <Field label="New password" required hint="At least 12 characters.">
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={form.next}
                  onChange={(e) => setForm({ ...form, next: e.target.value })}
                />
              )}
            </Field>
            <Field label="Repeat new password" required>
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                />
              )}
            </Field>
            <p className="text-xs text-ink-muted">After changing it you will be signed out on every device.</p>
            <Button type="submit" loading={saving}>
              Change Password
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
