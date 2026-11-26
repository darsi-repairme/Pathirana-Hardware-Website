"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Camera, KeyRound, LogOut, UserRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useOwnPhoto, useStaff } from "@/components/AdminShell";
import { ProfilePhotoEditor } from "@/components/ProfilePhoto";
import { Alert, Button, Card, Field, PageHeader, PasswordInput } from "@/components/ui";
import { useValidation, type Rules } from "@/lib/useValidation";

type PasswordForm = { current: string; next: string; confirm: string };
const RULES: Rules<PasswordForm> = {
  current: (v) => (String(v ?? "") ? null : "Enter your current password."),
  next: (v) => {
    const s = String(v ?? "");
    if (s.length < 12) return "Use at least 12 characters.";
    return s.length > 128 ? "Use at most 128 characters." : null;
  },
  confirm: (v, all) => (String(v ?? "") === all.next ? null : "The new passwords do not match."),
};

/**
 * Settings that genuinely exist: your account details, changing your own
 * password, and signing out of every device.
 */
export default function SettingsPage() {
  const me = useStaff();
  const photo = useOwnPhoto();
  const router = useRouter();
  const toLogin = () => {
    router.replace("/login?signedOut=1");
    router.refresh();
  };
  const [form, setForm] = useState<PasswordForm>({ current: "", next: "", confirm: "" });
  const v = useValidation(form, RULES);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  /** Changing it remounts the password fields (all hidden again). */
  const [fieldsKey, setFieldsKey] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  const change = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return; // one request at a time
    setError(null);
    if (!v.validateAll()) return;
    setSaving(true);
    try {
      await api.post("auth/password", { currentPassword: form.current, newPassword: form.next });
    } catch (err) {
      const ex = err as ApiError;
      setError(
        ex.status === 429
          ? new ApiError(429, "Too many attempts. Please wait a minute and try again.")
          : ex.status === 0 || ex.status >= 500 || !(ex instanceof ApiError)
            ? new ApiError(ex.status ?? 0, "Unable to change password. Please try again.")
            : ex,
      );
      setSaving(false);
      return;
    }
    // Changed (the API confirmed it). Clear the fields and hide them again, then — as before —
    // every session (including this one) has ended: sign in again with the new password. Clearing
    // this device's cookie is best effort; a failure there must not look like a failed change.
    setForm({ current: "", next: "", confirm: "" });
    setFieldsKey((k) => k + 1);
    await fetch("/api/session", { method: "DELETE", headers: { "x-ph-admin": "1" } }).catch(() => {});
    router.replace("/login?passwordChanged=1");
    router.refresh();
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);
    await fetch("/api/session", { method: "DELETE", headers: { "x-ph-admin": "1" } }).catch(() => {});
    toLogin();
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account, profile photo and sign-in security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
            <Camera aria-hidden="true" className="size-5 text-brass" /> Profile photo
          </h2>
          <div className="mt-4">
            <ProfilePhotoEditor
              name={me.fullName}
              target={{ self: true }}
              version={photo.version}
              onChange={photo.setVersion}
            />
          </div>
        </Card>
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
                  : "Editor — catalogue, delivery areas, services, gallery, quotation requests and feedback",
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
          <form noValidate onSubmit={change} className="mt-4 space-y-4">
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
            <Field key={`current-${fieldsKey}`} label="Current password" required error={v.error("current")}>
              {(p) => (
                <PasswordInput
                  {...p}
                  autoComplete="current-password"
                  value={form.current}
                  onBlur={v.blur("current")}
                  onChange={(e) => setForm({ ...form, current: e.target.value })}
                />
              )}
            </Field>
            <Field
              key={`next-${fieldsKey}`}
              label="New password"
              required
              hint="At least 12 characters."
              error={v.error("next")}
            >
              {(p) => (
                <PasswordInput
                  {...p}
                  maxLength={128}
                  autoComplete="new-password"
                  value={form.next}
                  onBlur={v.blur("next")}
                  onChange={(e) => setForm({ ...form, next: e.target.value })}
                />
              )}
            </Field>
            <Field key={`confirm-${fieldsKey}`} label="Repeat new password" required error={v.error("confirm")}>
              {(p) => (
                <PasswordInput
                  {...p}
                  autoComplete="new-password"
                  value={form.confirm}
                  onBlur={v.blur("confirm")}
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
