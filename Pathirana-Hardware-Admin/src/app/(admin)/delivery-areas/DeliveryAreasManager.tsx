"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, Pencil, Plus, Truck } from "lucide-react";
import { api, ApiError, formatDate, type DeliveryArea } from "@/lib/api";
import { useApi } from "@/lib/useApi";
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
  SearchBox,
  Select,
  Spinner,
  TableWrap,
  Textarea,
  td,
  th,
} from "@/components/ui";

type Form = { name: string; district: string; postalCode: string; notes: string; feeLkr: string; isActive: boolean };
const empty: Form = { name: "", district: "", postalCode: "", notes: "", feeLkr: "", isActive: true };
type StatusFilter = "all" | "active" | "inactive" | "archived";

const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;

export function DeliveryAreasManager({ openNew }: { openNew: boolean }) {
  const router = useRouter();
  const list = useApi<{ items: DeliveryArea[] }>("admin/delivery-areas?includeArchived=true");
  const items = list.data?.items ?? null;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<DeliveryArea | "new" | null>(openNew ? "new" : null);
  const [form, setForm] = useState<Form>(empty);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ area: DeliveryArea; action: "toggle" | "archive" } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = list.reload;

  // Dashboard shortcut (/delivery-areas?new=1) opened the form; tidy the URL.
  useEffect(() => {
    if (openNew) router.replace("/delivery-areas");
  }, [openNew, router]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter((a) => {
      const st = a.archivedAt ? "archived" : a.isActive ? "active" : "inactive";
      if (status === "all" ? st === "archived" : st !== status) return false;
      return (
        !t ||
        a.name.toLowerCase().includes(t) ||
        (a.district ?? "").toLowerCase().includes(t) ||
        (a.postalCode ?? "").includes(t)
      );
    });
  }, [items, q, status]);

  const open = (a: DeliveryArea | "new") => {
    setEditing(a);
    setFormError(null);
    setForm(
      a === "new"
        ? empty
        : {
            name: a.name,
            district: a.district ?? "",
            postalCode: a.postalCode ?? "",
            notes: a.notes ?? "",
            feeLkr: a.feeLkr === null ? "" : String(a.feeLkr),
            isActive: a.isActive,
          },
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const fee = form.feeLkr.trim();
    const body = {
      name: form.name,
      district: form.district.trim() || null,
      postalCode: form.postalCode.trim() || null,
      notes: form.notes.trim() || null,
      feeLkr: fee === "" ? null : Number(fee),
      ...(editing === "new" ? { isActive: form.isActive } : {}),
    };
    try {
      if (editing === "new") await api.post("admin/delivery-areas", body);
      else if (editing) await api.patch(`admin/delivery-areas/${editing.id}`, body);
      setNotice(`Delivery area “${form.name.trim()}” ${editing === "new" ? "added" : "saved"}.`);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  const doConfirm = async () => {
    if (!confirm) return;
    const { area, action } = confirm;
    setBusy(true);
    try {
      if (action === "archive") {
        await api.del(`admin/delivery-areas/${area.id}`);
        setNotice(`Delivery area “${area.name}” archived.`);
      } else {
        await api.patch(`admin/delivery-areas/${area.id}/status`, { isActive: !area.isActive });
        setNotice(`Delivery area “${area.name}” ${area.isActive ? "deactivated" : "activated"}.`);
      }
      setConfirm(null);
      load();
    } catch (err) {
      setError((err as Error).message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const activeCount = (items ?? []).filter((a) => a.isActive && !a.archivedAt).length;

  return (
    <>
      <PageHeader
        title="Delivery Areas"
        description={
          <>
            Active areas are used by the Home page checker straight away. Add only areas, fees and notes the shop has
            confirmed. <strong className="text-forest">{activeCount}</strong> active.
          </>
        }
        actions={
          <Button onClick={() => open("new")} icon={<Plus aria-hidden="true" className="size-4" />}>
            Add Delivery Area
          </Button>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error || list.error ? (
        <div className="mb-4">
          <Alert onRetry={load}>{error ?? list.error}</Alert>
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line/70 p-4 sm:flex-row sm:items-center">
          <SearchBox
            value={q}
            onChange={setQ}
            label="Search by area, district or postal code"
            placeholder="Search areas"
          />
          <label className="sr-only" htmlFor="area-status">
            Status
          </label>
          <Select
            id="area-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="sm:w-48"
          >
            <option value="all">Current (not archived)</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        {!items && !list.error ? <Spinner /> : null}
        {items && shown.length === 0 ? (
          <EmptyState icon={<Truck />} title={items.length ? "No matching delivery areas" : "No delivery areas yet"}>
            {items.length
              ? "Try a different search or status."
              : "Until the shop confirms its delivery areas, the website asks customers to confirm delivery on WhatsApp."}
          </EmptyState>
        ) : null}
        {shown.length ? (
          <TableWrap>
            <table className="w-full min-w-[46rem]">
              <thead className="bg-cream/60">
                <tr>
                  <th scope="col" className={th}>
                    Area
                  </th>
                  <th scope="col" className={th}>
                    Postal code
                  </th>
                  <th scope="col" className={th}>
                    Fee
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {shown.map((a) => (
                  <tr key={a.id} className="hover:bg-cream/40">
                    <td className={td}>
                      <p className="font-semibold text-charcoal">{a.name}</p>
                      <p className="text-xs text-ink-muted">{a.district ?? "District not set"}</p>
                      {a.notes ? <p className="mt-0.5 max-w-xs truncate text-xs text-ink-muted">{a.notes}</p> : null}
                    </td>
                    <td className={`${td} tabular-nums`}>{a.postalCode ?? "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {a.feeLkr === null ? <span className="text-ink-muted">Not published</span> : lkr(a.feeLkr)}
                    </td>
                    <td className={td}>
                      {a.archivedAt ? (
                        <span title={`Archived ${formatDate(a.archivedAt)}`}>
                          <Badge>Archived</Badge>
                        </span>
                      ) : a.isActive ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="gold">Inactive</Badge>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      {a.archivedAt ? (
                        <span className="text-xs text-ink-muted">Kept for history</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => open(a)}
                            icon={<Pencil aria-hidden="true" className="size-3.5" />}
                          >
                            Edit<span className="sr-only"> {a.name}</span>
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setConfirm({ area: a, action: "toggle" })}>
                            {a.isActive ? "Deactivate" : "Activate"}
                            <span className="sr-only"> {a.name}</span>
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setConfirm({ area: a, action: "archive" })}
                            icon={<Archive aria-hidden="true" className="size-3.5" />}
                          >
                            Archive<span className="sr-only"> {a.name}</span>
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : null}
      </Card>

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add delivery area" : "Edit delivery area"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="area-form" loading={saving}>
              {editing === "new" ? "Add Area" : "Save Changes"}
            </Button>
          </>
        }
      >
        <form id="area-form" onSubmit={save} className="space-y-4">
          <Alert tone="info">Enter only locations, fees and notes confirmed by the shop.</Alert>
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
          <Field label="Area name" required>
            {(p) => (
              <Input
                {...p}
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="District" hint="Optional.">
              {(p) => (
                <Input
                  {...p}
                  maxLength={80}
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              )}
            </Field>
            <Field label="Postal code" hint="Optional. 5 digits.">
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })}
                />
              )}
            </Field>
          </div>
          <Field
            label="Approved delivery fee (LKR)"
            hint="Optional. Leave empty unless the shop has approved a fee for this area."
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                value={form.feeLkr}
                onChange={(e) => setForm({ ...form, feeLkr: e.target.value })}
              />
            )}
          </Field>
          <Field label="Delivery notes" hint="Optional. Shown to customers when the area is found.">
            {(p) => (
              <Textarea
                {...p}
                maxLength={500}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            )}
          </Field>
          {editing === "new" ? (
            <label className="flex items-center gap-3 text-sm font-semibold text-charcoal">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="size-4 accent-forest"
              />
              Active (shown to customers immediately)
            </label>
          ) : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.action === "archive"
            ? "Archive delivery area?"
            : confirm?.area.isActive
              ? "Deactivate delivery area?"
              : "Activate delivery area?"
        }
        message={
          confirm?.action === "archive"
            ? `“${confirm.area.name}” will be removed from the website checker and this list. It is kept in the archive for history.`
            : confirm?.area.isActive
              ? `Customers checking “${confirm.area.name}” will be asked to confirm delivery with the team instead.`
              : `Customers checking “${confirm?.area.name}” will be told the shop delivers there.`
        }
        confirmLabel={confirm?.action === "archive" ? "Archive" : confirm?.area.isActive ? "Deactivate" : "Activate"}
        danger={confirm?.action === "archive" || confirm?.area.isActive}
        busy={busy}
        onConfirm={doConfirm}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
