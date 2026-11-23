"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Copy, KeyRound, Pencil, Plus, Power, UserCog, Users } from "lucide-react";
import { api, ApiError, formatDate, type Role, type StaffMember } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useStaff } from "@/components/AdminShell";
import { email, required, useValidation, type Rules } from "@/lib/useValidation";
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchBox,
  Select,
  Spinner,
  TableWrap,
  td,
  th,
} from "@/components/ui";

type Form = { fullName: string; email: string; role: Role };
const RULES: Rules<Form> = {
  fullName: (v) => required("the full name")(v),
  email: (v) => email(v),
};
type LinkInfo = { name: string; url: string; expiresAt: string; purpose: "setup" | "reset" };

/**
 * Staff accounts (admins only — the API enforces it on every call too). Accounts are created
 * WITHOUT a password: the admin passes a one-time set-up link (24 h, single use) privately to
 * the person, who chooses their own password. Nobody else ever sees it. Accounts are never
 * deleted (audit history stays intact): deactivate instead.
 */
export function StaffManager() {
  const me = useStaff();
  const list = useApi<StaffMember[]>("admin/staff");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pageError, setPageError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [form, setForm] = useState<Form>({ fullName: "", email: "", role: "editor" });
  const v = useValidation(form, RULES);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleFor, setRoleFor] = useState<StaffMember | null>(null);
  const [newRole, setNewRole] = useState<Role>("editor");
  const [toggle, setToggle] = useState<StaffMember | null>(null);
  const [linkFor, setLinkFor] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<ApiError | null>(null);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const items = list.data;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter(
      (s) => !t || s.fullName.toLowerCase().includes(t) || s.email.includes(t) || s.role.includes(t),
    );
  }, [items, q]);
  const activeAdmins = (items ?? []).filter((s) => s.role === "admin" && s.isActive).length;

  const makeLink = async (s: Pick<StaffMember, "id" | "fullName">, purpose: "setup" | "reset") => {
    const r = await api.post<{ token: string; expiresAt: string }>(`admin/staff/${s.id}/password-link`, { purpose });
    // The page only exists on THIS Admin site: build the link from the current origin.
    setLink({
      name: s.fullName,
      url: `${window.location.origin}/setup-password?token=${r.token}`,
      expiresAt: r.expiresAt,
      purpose,
    });
    setCopied(false);
  };

  const openForm = (s: StaffMember | "new") => {
    setEditing(s);
    setFormError(null);
    v.reset();
    setForm(
      s === "new"
        ? { fullName: "", email: "", role: "editor" }
        : { fullName: s.fullName, email: s.email, role: s.role },
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing === "new") {
        const created = await api.post<StaffMember>("admin/staff", {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
        });
        setEditing(null);
        setPageError(null);
        try {
          await makeLink(created, "setup");
          setNotice(`Account created for ${created.fullName}. Pass on the one-time set-up link privately.`);
        } catch (linkErr) {
          // The account exists; only the link failed. Say so plainly and point to the retry action.
          setNotice(`Account created for ${created.fullName}.`);
          const le = linkErr instanceof ApiError ? linkErr : new ApiError(0, (linkErr as Error).message);
          setPageError(
            new ApiError(le.status, `${le.message} Use “Set-up link” on ${created.fullName}'s row to try again.`),
          );
        }
      } else if (editing) {
        await api.patch(`admin/staff/${editing.id}`, { fullName: form.fullName.trim(), email: form.email.trim() });
        setNotice(`Details saved for ${form.fullName.trim()}.`);
        setEditing(null);
      }
      list.reload();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, msg: string, close: () => void) => {
    setBusy(true);
    setDialogError(null);
    try {
      await fn();
      setNotice(msg);
      close();
      list.reload();
    } catch (e) {
      setDialogError(e as ApiError);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Staff"
        description="Staff sign in with their own email and password. Admins manage staff, settings and everything else; editors manage the catalogue, services, gallery, quotations and feedback."
        actions={
          <Button onClick={() => openForm("new")}>
            <Plus aria-hidden="true" className="size-4" /> Add Staff
          </Button>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {pageError ? (
        <div className="mb-4">
          <Alert>{pageError.message}</Alert>
        </div>
      ) : null}
      <div className="mb-4 max-w-sm">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, email or role" label="Search staff" />
      </div>
      {list.error ? (
        <Alert onRetry={list.reload}>{list.error}</Alert>
      ) : !items ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={q ? "No staff match your search." : "No staff accounts"}
        />
      ) : (
        <TableWrap>
          <table className="rtable w-full text-left xl:min-w-[44rem]">
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
              {shown.map((s) => {
                const self = s.id === me.id;
                return (
                  <tr key={s.id} data-staff={s.email} className="hover:bg-cream/40">
                    <td className={`${td} rtable-main`}>
                      <p className="font-semibold text-charcoal">
                        {s.fullName} {self ? <span className="text-xs font-normal text-ink-muted">(you)</span> : null}
                      </p>
                      <p className="text-xs [overflow-wrap:anywhere] text-ink-muted">{s.email}</p>
                    </td>
                    <td className={td}>
                      <Badge tone={s.role === "admin" ? "gold" : "green"}>
                        {s.role === "admin" ? "Admin" : "Editor"}
                      </Badge>
                    </td>
                    <td className={td}>
                      {s.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="grey">Deactivated</Badge>}
                      {s.setupLinkPending ? (
                        <span className="mt-1 block text-xs text-brass-ink">Link not used yet</span>
                      ) : null}
                    </td>
                    <td className={`${td} text-xs text-ink-muted`}>
                      {s.lastLoginAt ? formatDate(s.lastLoginAt) : "Never"}
                    </td>
                    <td className={`${td} rtable-actions text-right`}>
                      <div className="row-actions">
                        <Button size="sm" variant="ghost" onClick={() => openForm(s)}>
                          <Pencil aria-hidden="true" className="size-4" /> Edit
                          <span className="sr-only"> {s.fullName}</span>
                        </Button>
                        {self ? null : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRoleFor(s);
                                setNewRole(s.role);
                                setDialogError(null);
                              }}
                            >
                              <UserCog aria-hidden="true" className="size-4" /> Role
                              <span className="sr-only"> for {s.fullName}</span>
                            </Button>
                            {s.isActive ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setLinkFor(s);
                                  setDialogError(null);
                                }}
                              >
                                <KeyRound aria-hidden="true" className="size-4" />
                                {s.lastLoginAt ? "Reset link" : "Set-up link"}
                                <span className="sr-only"> for {s.fullName}</span>
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setToggle(s);
                                setDialogError(null);
                              }}
                            >
                              <Power aria-hidden="true" className="size-4" /> {s.isActive ? "Deactivate" : "Reactivate"}
                              <span className="sr-only"> {s.fullName}</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      {/* Add / edit */}
      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add Staff Member" : "Edit Staff Member"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" loading={saving}>
              {editing === "new" ? "Create Account" : "Save Details"}
            </Button>
          </>
        }
      >
        <form id="staff-form" noValidate onSubmit={save} className="space-y-4">
          {formError ? (
            <Alert>
              {formError.message}
              {formError.details.length ? (
                <ul className="mt-1 list-disc pl-4">
                  {formError.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}
          <Field label="Full name" required error={v.error("fullName")}>
            {(p) => (
              <Input
                {...p}
                autoComplete="off"
                maxLength={120}
                value={form.fullName}
                onBlur={v.blur("fullName")}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Email address"
            required
            hint={
              editing !== "new"
                ? "Changing the email signs this person out; they sign in with the new email."
                : "Used to sign in."
            }
            error={v.error("email")}
          >
            {(p) => (
              <Input
                {...p}
                type="email"
                autoComplete="off"
                maxLength={254}
                value={form.email}
                onBlur={v.blur("email")}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
          </Field>
          {editing === "new" ? (
            <>
              <Field label="Role" required>
                {(p) => (
                  <Select {...p} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                    <option value="editor">Editor — catalogue, services, gallery, quotations, feedback</option>
                    <option value="admin">Admin — everything, including staff and settings</option>
                  </Select>
                )}
              </Field>
              <Alert tone="info">
                No password is set here. After creating the account you get a one-time link (valid 24 hours) to pass on
                privately; the person opens it and chooses their own password.
              </Alert>
            </>
          ) : null}
        </form>
      </Dialog>

      {/* Role */}
      <Dialog
        open={roleFor !== null}
        title="Change role"
        onClose={() => setRoleFor(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleFor(null)}>
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                roleFor &&
                run(
                  () => api.patch(`admin/staff/${roleFor.id}/role`, { role: newRole }),
                  `${roleFor.fullName} is now ${newRole === "admin" ? "an admin" : "an editor"}.`,
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
          {dialogError ? <Alert>{dialogError.message}</Alert> : null}
          <Field label={`Role for ${roleFor?.fullName ?? ""}`} optional={false}>
            {(p) => (
              <Select {...p} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Select>
            )}
          </Field>
          <p className="text-sm text-ink-muted">The person is signed out and signs in again with the new role.</p>
        </div>
      </Dialog>

      {/* Deactivate / reactivate */}
      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isActive ? "Deactivate account?" : "Reactivate account?"}
        message={
          dialogError
            ? dialogError.message
            : toggle?.isActive
              ? `${toggle.fullName} is signed out at once and can no longer sign in. Their history is kept. You can reactivate the account later.${
                  toggle.role === "admin" && activeAdmins <= 1
                    ? " (This is the only active admin — the server will refuse.)"
                    : ""
                }`
              : `${toggle?.fullName} can sign in again with their existing password (or send them a reset link).`
        }
        confirmLabel={toggle?.isActive ? "Deactivate" : "Reactivate"}
        danger={toggle?.isActive}
        busy={busy}
        onConfirm={() =>
          toggle &&
          run(
            () => api.patch(`admin/staff/${toggle.id}/status`, { isActive: !toggle.isActive }),
            `${toggle.fullName} ${toggle.isActive ? "deactivated" : "reactivated"}.`,
            () => setToggle(null),
          )
        }
        onClose={() => setToggle(null)}
      />

      {/* New link */}
      <ConfirmDialog
        open={linkFor !== null}
        title={linkFor?.lastLoginAt ? "Create a password reset link?" : "Create a new set-up link?"}
        message={
          dialogError
            ? dialogError.message
            : `A one-time link for ${linkFor?.fullName ?? ""} (valid 24 hours). Any earlier unused link stops working. Their current password keeps working until they use the link.`
        }
        confirmLabel="Create Link"
        busy={busy}
        onConfirm={() =>
          linkFor &&
          run(
            () => makeLink(linkFor, linkFor.lastLoginAt ? "reset" : "setup"),
            `One-time link created for ${linkFor.fullName}.`,
            () => setLinkFor(null),
          )
        }
        onClose={() => setLinkFor(null)}
      />

      {/* Show the link once */}
      <Dialog open={link !== null} title="One-time password link" onClose={() => setLink(null)}>
        {link ? (
          <div className="space-y-4" data-password-link>
            <p className="text-sm text-charcoal">
              Pass this link <strong>privately</strong> to <strong>{link.name}</strong> (in person, by phone or a
              private message). It works <strong>once</strong> and expires on {formatDate(link.expiresAt)}. It is shown
              only now.
            </p>
            <div className="rounded-xl border border-line/70 bg-cream/60 p-3 font-mono text-xs [overflow-wrap:anywhere]">
              {link.url}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy}>
                <Copy aria-hidden="true" className="size-4" /> {copied ? "Copied" : "Copy Link"}
              </Button>
              <Button variant="outline" onClick={() => setLink(null)}>
                Done
              </Button>
            </div>
            {link.url.startsWith("http://") && !/\/\/(localhost|127\.0\.0\.1)/.test(link.url) ? (
              <Alert>This Admin is not using HTTPS. Use links only on a secure (https://) Admin address.</Alert>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
