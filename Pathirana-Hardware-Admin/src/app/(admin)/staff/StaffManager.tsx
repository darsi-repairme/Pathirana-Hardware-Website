"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Plus, UserCog, Users } from "lucide-react";
import { api, ApiError, formatDate, type Role, type StaffMember } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useStaff } from "@/components/AdminShell";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  TableWrap,
  td,
  th,
} from "@/components/ui";

const ROLE_INFO: Record<Role, string> = {
  admin: "Everything, including staff accounts",
  editor: "Products, categories, brands and delivery areas",
};

function ErrorBox({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
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
  );
}

export function StaffManager() {
  const me = useStaff();
  const list = useApi<StaffMember[]>("admin/staff");
  const items = list.data ?? null;
  const [notice, setNotice] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "editor" as Role, password: "", confirm: "" });
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const [roleFor, setRoleFor] = useState<StaffMember | null>(null);
  const [newRole, setNewRole] = useState<Role>("editor");
  const [pwFor, setPwFor] = useState<StaffMember | null>(null);
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [toggle, setToggle] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<ApiError | null>(null);

  const load = list.reload;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setFormError(new ApiError(400, "The passwords do not match."));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post("admin/staff", {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        password: form.password,
      });
      setNotice(`Account created for ${form.fullName.trim()}. Share the password with them privately.`);
      setCreating(false);
      setForm({ email: "", fullName: "", role: "editor", password: "", confirm: "" });
      load();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, message: string, close: () => void) => {
    setBusy(true);
    setDialogError(null);
    try {
      await fn();
      setNotice(message);
      close();
      load();
    } catch (err) {
      setDialogError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Staff"
        description="Accounts that can sign in to this admin. There is no public registration."
        actions={
          <Button
            onClick={() => {
              setCreating(true);
              setFormError(null);
            }}
            icon={<Plus aria-hidden="true" className="size-4" />}
          >
            Add Staff Member
          </Button>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {list.error ? (
        <div className="mb-4">
          <Alert onRetry={load}>{list.error}</Alert>
        </div>
      ) : null}

      <Card>
        {!items && !list.error ? <Spinner /> : null}
        {items && items.length === 0 ? <EmptyState icon={<Users />} title="No staff accounts" /> : null}
        {items && items.length ? (
          <TableWrap>
            <table className="w-full min-w-[48rem]">
              <thead className="bg-cream/60">
                <tr>
                  <th scope="col" className={th}>
                    Name
                  </th>
                  <th scope="col" className={th}>
                    Role
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Last sign-in
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {items.map((s) => {
                  const self = s.id === me.id;
                  return (
                    <tr key={s.id} className="hover:bg-cream/40">
                      <td className={td}>
                        <p className="font-semibold text-charcoal">
                          {s.fullName} {self ? <span className="text-xs font-normal text-ink-muted">(you)</span> : null}
                        </p>
                        <p className="text-xs text-ink-muted">{s.email}</p>
                      </td>
                      <td className={td}>
                        <Badge tone={s.role === "admin" ? "gold" : "green"}>
                          {s.role === "admin" ? "Admin" : "Editor"}
                        </Badge>
                      </td>
                      <td className={td}>
                        {s.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                      </td>
                      <td className={`${td} text-xs whitespace-nowrap text-ink-muted`}>{formatDate(s.lastLoginAt)}</td>
                      <td className={`${td} text-right`}>
                        {self ? (
                          <span className="text-xs text-ink-muted">Change your password in Settings</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<UserCog aria-hidden="true" className="size-3.5" />}
                              onClick={() => {
                                setRoleFor(s);
                                setNewRole(s.role);
                                setDialogError(null);
                              }}
                            >
                              Role<span className="sr-only"> for {s.fullName}</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<KeyRound aria-hidden="true" className="size-3.5" />}
                              onClick={() => {
                                setPwFor(s);
                                setPw({ password: "", confirm: "" });
                                setDialogError(null);
                              }}
                            >
                              Reset password<span className="sr-only"> for {s.fullName}</span>
                            </Button>
                            <Button
                              variant={s.isActive ? "danger" : "outline"}
                              size="sm"
                              onClick={() => {
                                setToggle(s);
                                setDialogError(null);
                              }}
                            >
                              {s.isActive ? "Deactivate" : "Activate"}
                              <span className="sr-only"> {s.fullName}</span>
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : null}
      </Card>

      {/* Create */}
      <Dialog
        open={creating}
        title="Add staff member"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" loading={saving}>
              Create Account
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={create} className="space-y-4">
          <ErrorBox error={formError} />
          <Field label="Full name" required>
            {(p) => (
              <Input
                {...p}
                required
                maxLength={120}
                autoComplete="off"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            )}
          </Field>
          <Field label="Email" required>
            {(p) => (
              <Input
                {...p}
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
          </Field>
          <Field label="Role" required hint={ROLE_INFO[form.role]}>
            {(p) => (
              <Select {...p} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Select>
            )}
          </Field>
          <Field
            label="Temporary password"
            required
            hint="At least 12 characters. Share it privately; they can change it in Settings."
          >
            {(p) => (
              <Input
                {...p}
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            )}
          </Field>
          <Field label="Repeat password" required>
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
        </form>
      </Dialog>

      {/* Role */}
      <Dialog
        open={roleFor !== null}
        title="Change role"
        onClose={() => setRoleFor(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              disabled={roleFor?.role === newRole}
              onClick={() =>
                roleFor &&
                run(
                  () => api.patch(`admin/staff/${roleFor.id}/role`, { role: newRole }),
                  `${roleFor.fullName} is now ${newRole === "admin" ? "an Admin" : "an Editor"}.`,
                  () => setRoleFor(null),
                )
              }
            >
              Save Role
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBox error={dialogError} />
          <Field
            label={`Role for ${roleFor?.fullName ?? ""}`}
            hint={`${ROLE_INFO[newRole]}. They will be signed out so the change applies at once.`}
          >
            {(p) => (
              <Select {...p} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Select>
            )}
          </Field>
        </div>
      </Dialog>

      {/* Password reset */}
      <Dialog
        open={pwFor !== null}
        title="Reset password"
        onClose={() => setPwFor(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPwFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                if (!pwFor) return;
                if (pw.password !== pw.confirm) return setDialogError(new ApiError(400, "The passwords do not match."));
                run(
                  () => api.patch(`admin/staff/${pwFor.id}/password`, { password: pw.password }),
                  `Password reset for ${pwFor.fullName}. Share it with them privately.`,
                  () => setPwFor(null),
                );
              }}
            >
              Set Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBox error={dialogError} />
          <p className="text-sm text-ink-muted">
            Sets a new password for <strong className="text-charcoal">{pwFor?.fullName}</strong>, unlocks the account
            and signs it out everywhere.
          </p>
          <Field label="New password" required hint="At least 12 characters.">
            {(p) => (
              <Input
                {...p}
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={pw.password}
                onChange={(e) => setPw({ ...pw, password: e.target.value })}
              />
            )}
          </Field>
          <Field label="Repeat password" required>
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isActive ? "Deactivate account?" : "Activate account?"}
        message={
          <>
            {dialogError ? <ErrorBox error={dialogError} /> : null}
            {toggle?.isActive
              ? `${toggle.fullName} will be signed out immediately and will not be able to sign in.`
              : `${toggle?.fullName} will be able to sign in again.`}
          </>
        }
        confirmLabel={toggle?.isActive ? "Deactivate" : "Activate"}
        danger={toggle?.isActive}
        busy={busy}
        onConfirm={() =>
          toggle &&
          run(
            () => api.patch(`admin/staff/${toggle.id}/status`, { isActive: !toggle.isActive }),
            `${toggle.fullName} ${toggle.isActive ? "deactivated" : "activated"}.`,
            () => setToggle(null),
          )
        }
        onClose={() => setToggle(null)}
      />
    </>
  );
}
