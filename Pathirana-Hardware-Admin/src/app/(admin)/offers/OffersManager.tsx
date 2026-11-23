"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, Gift, Pencil, Plus, Shuffle } from "lucide-react";
import {
  api,
  ApiError,
  formatDate,
  type Category,
  type Offer,
  type OfferStatus,
  type ProductListItem,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useStaff } from "@/components/AdminShell";
import {
  colomboToday,
  digitsOnly,
  notPast,
  required,
  useValidation,
  wholeNumber,
  type Rules,
} from "@/lib/useValidation";
import {
  TranslationFields,
  emptyTranslationForm,
  fromTranslationForm,
  toTranslationForm,
  type TranslationForm,
} from "@/components/TranslationFields";
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
  Textarea,
  td,
  th,
} from "@/components/ui";

const STATUS: Record<OfferStatus, { label: string; tone: "green" | "gold" | "grey" | "red" }> = {
  active: { label: "Active", tone: "green" },
  scheduled: { label: "Scheduled", tone: "gold" },
  expired: { label: "Expired", tone: "red" },
  hidden: { label: "Hidden", tone: "grey" },
};

type Form = {
  title: string;
  benefit: string;
  description: string;
  discountType: Offer["discountType"];
  discountValue: string;
  promoCode: string;
  minPurchaseLkr: string;
  appliesTo: Offer["appliesTo"];
  productIds: string[];
  categoryIds: string[];
  startsOn: string;
  endsOn: string;
  /** Stored dates when editing (an unchanged older date stays valid). */
  origStartsOn: string;
  origEndsOn: string;
  sortOrder: string;
  translations: TranslationForm;
};

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const RULES: Rules<Form> = {
  title: (v) => required("the offer title")(v),
  discountValue: (v, all) => {
    if (all.discountType === "none") return null;
    const s = String(v ?? "").trim();
    if (!s) return "Enter the discount value.";
    if (!MONEY.test(s)) return "Use a number with at most 2 decimals (no minus sign).";
    const n = Number(s);
    if (n <= 0) return "The discount value must be more than 0.";
    if (all.discountType === "percentage" && n > 100) return "A percentage discount cannot be more than 100%.";
    return null;
  },
  promoCode: (v) => {
    const s = String(v ?? "").trim();
    return !s || /^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/.test(s) ? null : "Use 3–32 letters, digits or hyphens (no spaces).";
  },
  minPurchaseLkr: (v) => {
    const s = String(v ?? "").trim();
    return !s || MONEY.test(s) ? null : "Enter an amount in LKR with at most 2 decimals, or leave it empty.";
  },
  startsOn: (v, all) => notPast("start date", all.origStartsOn)(v),
  endsOn: (v, all) =>
    v && all.startsOn && String(v) < all.startsOn
      ? "The end date must be on or after the start date."
      : notPast("end date", all.origEndsOn)(v),
  appliesTo: (v, all) =>
    v === "selected" && !all.productIds.length && !all.categoryIds.length
      ? "Choose at least one product or category, or apply the offer to all products."
      : null,
  sortOrder: (v) => wholeNumber("Display order")(v),
};

const empty = (order: number): Form => ({
  title: "",
  benefit: "",
  description: "",
  discountType: "none",
  discountValue: "",
  promoCode: "",
  minPurchaseLkr: "",
  appliesTo: "all",
  productIds: [],
  categoryIds: [],
  startsOn: "",
  endsOn: "",
  origStartsOn: "",
  origEndsOn: "",
  sortOrder: String(order),
  translations: emptyTranslationForm(),
});

/** A random, readable code (no 0/O/1/I) — staff can edit it. */
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PH-${[...bytes].map((b) => chars[b % chars.length]).join("")}`;
}

const lkr = (n: number) => `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const discountText = (o: Pick<Offer, "discountType" | "discountValue">) =>
  o.discountType === "percentage" && o.discountValue
    ? `${o.discountValue}% off`
    : o.discountType === "fixed" && o.discountValue
      ? `${lkr(o.discountValue)} off`
      : "No fixed discount";

/**
 * Offers & promo codes shown in the website header (only published offers within their dates).
 * There is no online checkout: customers quote a code in a quotation request, the API records
 * whether it applied, and staff confirm the final price. Offers never change product prices.
 */
export function OffersManager() {
  const me = useStaff();
  const canPublish = me.role === "admin";
  const list = useApi<Offer[]>("admin/offers");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [form, setForm] = useState<Form>(() => empty(0));
  const v = useValidation(form, RULES);
  const today = colomboToday();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toggle, setToggle] = useState<Offer | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<{ products: ProductListItem[]; categories: Category[] } | null>(null);
  const [pickQ, setPickQ] = useState("");

  const items = list.data;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter(
      (o) => !t || o.title.toLowerCase().includes(t) || (o.promoCode ?? "").toLowerCase().includes(t),
    );
  }, [items, q]);

  // Products and categories for the eligibility picker (loaded once, when the dialog first opens).
  useEffect(() => {
    if (editing === null || catalogue) return;
    let cancelled = false;
    (async () => {
      const categories = (await api.get<{ items: Category[] }>("admin/categories")).items;
      const products: ProductListItem[] = [];
      for (let page = 1; page <= 40; page++) {
        const r = await api.get<{ items: ProductListItem[]; total: number }>(`admin/products?limit=50&page=${page}`);
        products.push(...r.items);
        if (products.length >= r.total || !r.items.length) break;
      }
      if (!cancelled) setCatalogue({ products, categories });
    })().catch(() => {
      if (!cancelled) setCatalogue({ products: [], categories: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [editing, catalogue]);

  const open = (o: Offer | "new") => {
    setEditing(o);
    setFormError(null);
    v.reset();
    setPickQ("");
    setForm(
      o === "new"
        ? empty((items?.length ?? 0) * 10)
        : {
            title: o.title,
            benefit: o.benefit,
            description: o.description,
            discountType: o.discountType,
            discountValue: o.discountValue === null ? "" : String(o.discountValue),
            promoCode: o.promoCode ?? "",
            minPurchaseLkr: o.minPurchaseLkr === null ? "" : String(o.minPurchaseLkr),
            appliesTo: o.appliesTo,
            productIds: o.products.map((p) => p.id),
            categoryIds: o.categories.map((c) => c.id),
            startsOn: o.startsOn ?? "",
            endsOn: o.endsOn ?? "",
            origStartsOn: o.startsOn ?? "",
            origEndsOn: o.endsOn ?? "",
            sortOrder: String(o.sortOrder),
            translations: toTranslationForm(o.translations),
          },
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.validateAll()) return;
    setSaving(true);
    setFormError(null);
    const body = {
      title: form.title.trim(),
      benefit: form.benefit.trim(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: form.discountType === "none" ? null : Number(form.discountValue),
      promoCode: form.promoCode.trim() ? form.promoCode.trim().toUpperCase() : null,
      minPurchaseLkr: form.minPurchaseLkr.trim() ? Number(form.minPurchaseLkr) : null,
      appliesTo: form.appliesTo,
      productIds: form.appliesTo === "selected" ? form.productIds : [],
      categoryIds: form.appliesTo === "selected" ? form.categoryIds : [],
      startsOn: form.startsOn || null,
      endsOn: form.endsOn || null,
      sortOrder: Number(form.sortOrder),
      translations: fromTranslationForm(form.translations),
    };
    try {
      if (editing === "new") await api.post<Offer>("admin/offers", body);
      else if (editing) await api.patch<Offer>(`admin/offers/${editing.id}`, body);
      setNotice(
        editing === "new"
          ? `Offer “${body.title}” saved as hidden.${canPublish ? " Publish it when it is ready." : " An admin can publish it."}`
          : `Offer “${body.title}” saved.`,
      );
      setEditing(null);
      list.reload();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggle) return;
    setToggling(true);
    setToggleError(null);
    try {
      await api.patch(`admin/offers/${toggle.id}/publication`, { isPublished: !toggle.isPublished });
      setNotice(
        toggle.isPublished
          ? `“${toggle.title}” hidden from the website.`
          : `“${toggle.title}” published. It shows in the website header while its dates allow.`,
      );
      setToggle(null);
      list.reload();
    } catch (err) {
      setToggleError((err as Error).message);
    } finally {
      setToggling(false);
    }
  };

  const pickable = useMemo(() => {
    const t = pickQ.trim().toLowerCase();
    const m = (s: string) => !t || s.toLowerCase().includes(t);
    return {
      categories: (catalogue?.categories ?? []).filter((c) => m(c.name)),
      products: (catalogue?.products ?? []).filter((p) => m(p.name) || m(p.categoryName)),
    };
  }, [catalogue, pickQ]);
  const toggleId = (key: "productIds" | "categoryIds", id: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  const previewDiscount =
    form.discountType !== "none" && Number(form.discountValue) > 0
      ? discountText({ discountType: form.discountType, discountValue: Number(form.discountValue) })
      : null;

  return (
    <>
      <PageHeader
        title="Offers & Promo Codes"
        description="Offers shown in the website header. New offers stay hidden until an admin publishes them. Customers quote the code in a quotation request; staff confirm the final price — offers never change product prices."
        actions={
          <Button onClick={() => open("new")}>
            <Plus aria-hidden="true" className="size-4" /> Add Offer
          </Button>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      <div className="mb-4 max-w-sm">
        <SearchBox value={q} onChange={setQ} placeholder="Search title or code" label="Search offers" />
      </div>

      {list.error ? (
        <Alert onRetry={list.reload}>{list.error}</Alert>
      ) : !items ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState icon={<Gift className="size-6" />} title={q ? "No offers match your search." : "No offers yet."}>
          {q
            ? null
            : "Create an offer when the shop has a real promotion. Nothing is shown on the website until it is published."}
        </EmptyState>
      ) : (
        <TableWrap>
          <table className="rtable w-full text-left xl:min-w-[48rem]">
            <thead className="bg-cream/60">
              <tr>
                <th scope="col" className={th}>
                  Offer
                </th>
                <th scope="col" className={th}>
                  Code
                </th>
                <th scope="col" className={th}>
                  Dates
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
              {shown.map((o) => (
                <tr key={o.id} data-offer={o.promoCode ?? o.title} className="hover:bg-cream/40">
                  <td className={`${td} rtable-main`}>
                    <p className="font-semibold text-charcoal">{o.title}</p>
                    <p className="text-xs text-ink-muted">
                      {o.benefit || discountText(o)} ·{" "}
                      {o.appliesTo === "all"
                        ? "All products"
                        : `${o.categories.length} categor${o.categories.length === 1 ? "y" : "ies"}, ${o.products.length} product${o.products.length === 1 ? "" : "s"}`}
                    </p>
                  </td>
                  <td className={`${td} font-mono text-sm font-semibold text-forest`}>{o.promoCode ?? "—"}</td>
                  <td className={`${td} text-xs text-ink-muted`}>
                    {o.startsOn ? formatDate(o.startsOn) : "Now"} – {o.endsOn ? formatDate(o.endsOn) : "No end date"}
                  </td>
                  <td className={td}>
                    <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                  </td>
                  <td className={`${td} rtable-actions text-right`}>
                    <div className="row-actions">
                      <Button variant="ghost" size="sm" onClick={() => open(o)} aria-label={`Edit ${o.title}`}>
                        <Pencil aria-hidden="true" className="size-4" /> Edit
                      </Button>
                      {canPublish ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setToggleError(null);
                            setToggle(o);
                          }}
                          aria-label={`${o.isPublished ? "Hide" : "Publish"} ${o.title}`}
                        >
                          {o.isPublished ? (
                            <>
                              <EyeOff aria-hidden="true" className="size-4" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye aria-hidden="true" className="size-4" /> Publish
                            </>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {!canPublish ? (
        <p className="mt-4 text-sm text-ink-muted">
          Editors prepare offers; an admin publishes or hides them and changes the code, discount or dates of a
          published offer.
        </p>
      ) : null}

      <Dialog
        open={editing !== null}
        title={editing === "new" ? "Add Offer" : `Edit Offer — ${editing?.title ?? ""}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="offer-form" loading={saving}>
              Save Offer
            </Button>
          </>
        }
      >
        <form id="offer-form" noValidate onSubmit={save} className="space-y-4">
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
          {editing !== "new" && editing?.isPublished && !canPublish ? (
            <Alert tone="info">This offer is live: only an admin can change its code, discount or dates.</Alert>
          ) : null}
          <Field label="Title" required error={v.error("title")}>
            {(p) => (
              <Input
                {...p}
                maxLength={120}
                value={form.title}
                onBlur={v.blur("title")}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            )}
          </Field>
          <Field label="Benefit headline" hint='Short, e.g. "10% off cement" or "Free delivery in Bangadeniya".'>
            {(p) => (
              <Input
                {...p}
                maxLength={120}
                value={form.benefit}
                onChange={(e) => setForm({ ...form, benefit: e.target.value })}
              />
            )}
          </Field>
          <Field label="Description" hint="Conditions customers should know. Shown in the offers panel.">
            {(p) => (
              <Textarea
                {...p}
                maxLength={1000}
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount type" optional={false}>
              {(p) => (
                <Select
                  {...p}
                  value={form.discountType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discountType: e.target.value as Form["discountType"],
                      discountValue: e.target.value === "none" ? "" : form.discountValue,
                    })
                  }
                >
                  <option value="none">No fixed discount (describe it above)</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (LKR)</option>
                </Select>
              )}
            </Field>
            <Field
              label={form.discountType === "fixed" ? "Discount amount (LKR)" : "Discount value (%)"}
              required={form.discountType !== "none"}
              error={v.error("discountValue")}
            >
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  maxLength={12}
                  disabled={form.discountType === "none"}
                  placeholder={
                    form.discountType === "none" ? "Not applicable" : form.discountType === "fixed" ? "0.00" : "e.g. 10"
                  }
                  value={form.discountValue}
                  onBlur={v.blur("discountValue")}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value.replace(/[^\d.]/g, "") })}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Promo code" hint="Optional. Unique. Letters, digits, hyphens." error={v.error("promoCode")}>
              {(p) => (
                <div className="flex gap-2">
                  <Input
                    {...p}
                    maxLength={32}
                    className="font-mono uppercase"
                    value={form.promoCode}
                    onBlur={v.blur("promoCode")}
                    onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase().replace(/\s/g, "") })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm({ ...form, promoCode: generateCode() })}
                    aria-label="Generate a promo code"
                  >
                    <Shuffle aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              )}
            </Field>
            <Field
              label="Minimum purchase (LKR)"
              hint="Optional. Staff check it when replying."
              error={v.error("minPurchaseLkr")}
            >
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  maxLength={12}
                  value={form.minPurchaseLkr}
                  onBlur={v.blur("minPurchaseLkr")}
                  onChange={(e) => setForm({ ...form, minPurchaseLkr: e.target.value.replace(/[^\d.]/g, "") })}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Start date" hint="Empty = from publishing. Today or later." error={v.error("startsOn")}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={form.origStartsOn && form.origStartsOn < today ? form.origStartsOn : today}
                  value={form.startsOn}
                  onBlur={v.blur("startsOn")}
                  onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                />
              )}
            </Field>
            <Field label="End date" hint="Empty = no end date." error={v.error("endsOn")}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={form.startsOn && form.startsOn > today ? form.startsOn : today}
                  value={form.endsOn}
                  onBlur={v.blur("endsOn")}
                  onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
                />
              )}
            </Field>
            <Field label="Display order" required hint="0 or more. Lower first." error={v.error("sortOrder")}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  maxLength={4}
                  value={form.sortOrder}
                  onBlur={v.blur("sortOrder")}
                  onChange={(e) => setForm({ ...form, sortOrder: digitsOnly(e.target.value) })}
                />
              )}
            </Field>
          </div>

          <fieldset className="rounded-xl border border-line/70 p-4">
            <legend className="px-1 text-sm font-semibold text-charcoal">Eligible items</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(["all", "selected"] as const).map((a) => (
                <label key={a} className="flex min-h-10 items-center gap-2">
                  <input
                    type="radio"
                    name="appliesTo"
                    className="size-4 accent-forest"
                    checked={form.appliesTo === a}
                    onChange={() => setForm({ ...form, appliesTo: a })}
                    onBlur={v.blur("appliesTo")}
                  />
                  {a === "all" ? "All products" : "Selected categories / products"}
                </label>
              ))}
            </div>
            {v.error("appliesTo") ? (
              <p role="alert" className="mt-1 text-sm font-semibold text-logo-red">
                {v.error("appliesTo")}
              </p>
            ) : null}
            {form.appliesTo === "selected" ? (
              <div className="mt-3 space-y-3" data-offer-picker>
                <SearchBox
                  value={pickQ}
                  onChange={setPickQ}
                  placeholder="Find a category or product"
                  label="Find items"
                />
                {!catalogue ? (
                  <Spinner label="Loading products…" />
                ) : (
                  <div className="grid max-h-64 gap-3 overflow-y-auto sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">Categories</p>
                      {pickable.categories.length ? (
                        pickable.categories.map((c) => (
                          <label key={c.id} className="flex min-h-9 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 accent-forest"
                              checked={form.categoryIds.includes(c.id)}
                              onChange={() => toggleId("categoryIds", c.id)}
                            />
                            <span className="[overflow-wrap:anywhere]">{c.name}</span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-ink-muted">No categories.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">Products</p>
                      {pickable.products.length ? (
                        pickable.products.map((p) => (
                          <label key={p.id} className="flex min-h-9 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 accent-forest"
                              checked={form.productIds.includes(p.id)}
                              onChange={() => toggleId("productIds", p.id)}
                            />
                            <span className="[overflow-wrap:anywhere]">
                              {p.name}
                              {p.isPublished ? null : <span className="text-xs text-ink-muted"> (draft)</span>}
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="text-sm text-ink-muted">No products.</p>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-ink-muted">
                  {form.categoryIds.length} categor{form.categoryIds.length === 1 ? "y" : "ies"} and{" "}
                  {form.productIds.length} product{form.productIds.length === 1 ? "" : "s"} selected. Only published
                  products and active categories are shown to customers.
                </p>
              </div>
            ) : null}
          </fieldset>

          {/* What customers see in the website's offers panel. */}
          <div aria-label="Preview" className="rounded-2xl border border-gold-soft/50 bg-cream/50 p-4">
            <p className="text-xs font-semibold tracking-wide text-brass-ink uppercase">Customer preview</p>
            <div className="mt-2 rounded-xl border border-line/70 bg-white p-3.5">
              <p className="font-semibold text-charcoal">{form.title.trim() || "Offer title"}</p>
              {form.benefit.trim() || previewDiscount ? (
                <p className="text-sm font-semibold text-logo-red">{form.benefit.trim() || previewDiscount}</p>
              ) : null}
              {form.description.trim() ? (
                <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">{form.description.trim()}</p>
              ) : null}
              {form.promoCode.trim() ? (
                <p className="mt-2 inline-block rounded-lg border border-dashed border-brass bg-cream/70 px-3 py-1.5 font-mono text-sm font-semibold text-forest">
                  {form.promoCode.trim().toUpperCase()}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-ink-muted">
                {form.endsOn ? `Valid until ${formatDate(form.endsOn)} · ` : ""}
                {form.appliesTo === "all" ? "Applies to all products" : "Applies to the selected items"}
              </p>
            </div>
          </div>

          <TranslationFields
            value={form.translations}
            onChange={(translations) => setForm({ ...form, translations })}
            fields={[
              { key: "title", label: "Title", english: form.title, maxLength: 120 },
              { key: "benefit", label: "Benefit headline", english: form.benefit, maxLength: 120 },
              { key: "description", label: "Description", english: form.description, multiline: true, maxLength: 1000 },
            ]}
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isPublished ? "Hide offer?" : "Publish offer?"}
        message={
          toggleError ??
          (toggle?.isPublished
            ? `“${toggle.title}” will no longer be shown on the website. Codes already quoted in requests are kept.`
            : `“${toggle?.title}” will be shown in the website header${toggle?.startsOn ? ` from ${formatDate(toggle.startsOn)}` : ""}${toggle?.endsOn ? ` until ${formatDate(toggle.endsOn)}` : ""}. Check the wording, code and dates first.`)
        }
        confirmLabel={toggle?.isPublished ? "Hide" : "Publish"}
        danger={toggle?.isPublished}
        busy={toggling}
        onConfirm={confirmToggle}
        onClose={() => setToggle(null)}
      />
    </>
  );
}
