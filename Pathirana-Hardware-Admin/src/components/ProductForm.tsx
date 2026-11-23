"use client";

import { useRouter } from "next/navigation";
import { DeleteProductCard } from "./DeleteProductCard";
import {
  emptyTranslationForm,
  fromTranslationForm,
  toTranslationForm,
  TranslationFields,
  type TranslationForm,
} from "./TranslationFields";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Pencil, Save, Star, Trash2, Upload } from "lucide-react";
import {
  api,
  ApiError,
  imageUrl,
  uploadImage,
  type Availability,
  type Brand,
  type Category,
  type DiscountType,
  type PricePreview,
  type Product,
} from "@/lib/api";
import { colomboToday, notPast } from "@/lib/useValidation";
import {
  AVAILABILITY_LABEL,
  DISCOUNT_STATUS_LABEL,
  formatLkr,
  formatPercent,
  priceFormErrors,
  UNIT_SUGGESTIONS,
  type PriceForm,
} from "@/lib/pricing";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";

type Form = PriceForm & {
  name: string;
  slug: string;
  categoryId: string;
  summary: string;
  description: string;
  searchTerms: string;
  brandIds: string[];
  unit: string;
  availability: Availability;
  published: boolean;
  translations: TranslationForm;
};

/** Changed discount dates must be today or later (Sri Lanka); unchanged stored dates stay valid. */
function pastDiscountDates(f: Form, stored: { start: string; end: string }): Record<string, string> {
  if (f.discountType === "none") return {};
  const out: Record<string, string> = {};
  const start = notPast("discount start date", stored.start)(f.discountStartsOn);
  const end = notPast("discount end date", stored.end)(f.discountEndsOn);
  if (start) out.discountStartsOn = start;
  if (end) out.discountEndsOn = end;
  return out;
}

const EMPTY: Form = {
  name: "",
  slug: "",
  categoryId: "",
  summary: "",
  description: "",
  searchTerms: "",
  brandIds: [],
  unit: "",
  priceLkr: "",
  // Honest defaults: no price is shown until staff enter one.
  contactForPrice: true,
  discountType: "none",
  discountValue: "",
  discountEnabled: false,
  discountStartsOn: "",
  discountEndsOn: "",
  availability: "on_request",
  published: false,
  translations: emptyTranslationForm(),
};

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
/** Matches the API default (MAX_UPLOAD_MB=5); the API enforces its own limit too. */
const MAX_BYTES = 5 * 1024 * 1024;

/** Request body for the price fields (empty → null; the API recalculates everything). */
const pricingBody = (f: Form) => ({
  priceLkr: f.priceLkr.trim() || null,
  contactForPrice: f.contactForPrice,
  discountType: f.discountType,
  discountValue: f.discountType === "none" ? null : f.discountValue.trim() || null,
  discountEnabled: f.discountType !== "none" && f.discountEnabled,
  discountStartsOn: f.discountStartsOn || null,
  discountEndsOn: f.discountEndsOn || null,
});

/**
 * Add / edit a product: details, unit, LKR price or Contact for Price, discount,
 * availability, brands (only when confirmed), images and publication.
 */
export function ProductForm({ productId, created = false }: { productId?: string; created?: boolean }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Form | null>(productId ? null : EMPTY);
  /** Stored discount dates (an unchanged older date stays valid; changed dates must be today or later). */
  const [storedDates, setStoredDates] = useState({ start: "", end: "" });
  const today = colomboToday();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(
    created ? "Product created as a draft. Add images, then publish it when it is ready." : null,
  );
  const [saving, setSaving] = useState(false);
  const [nonce, setNonce] = useState(0);
  const load = () => setNonce((n) => n + 1);

  // Load categories, brands and (when editing) the product; state is set only when it settles.
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<{ items: Category[] }>("admin/categories"),
      api.get<{ items: Brand[] }>("admin/brands"),
      productId ? api.get<Product>(`admin/products/${productId}`) : Promise.resolve(null),
    ])
      .then(([c, b, p]) => {
        if (!alive) return;
        setLoadError(null);
        setCategories(c.items);
        setBrands(b.items);
        if (p) {
          setProduct(p);
          setStoredDates({ start: p.discountStartsOn ?? "", end: p.discountEndsOn ?? "" });
          setForm({
            name: p.name,
            slug: p.slug,
            categoryId: p.categoryId,
            summary: p.summary ?? "",
            description: p.description ?? "",
            searchTerms: p.searchTerms.join(", "),
            brandIds: p.brands.map((x) => x.id),
            unit: p.unit ?? "",
            priceLkr: p.priceLkr ?? "",
            contactForPrice: p.contactForPrice,
            discountType: p.discountType,
            discountValue: p.discountValue ?? "",
            discountEnabled: p.discountEnabled,
            discountStartsOn: p.discountStartsOn ?? "",
            discountEndsOn: p.discountEndsOn ?? "",
            availability: p.availability,
            published: p.isPublished,
            translations: toTranslationForm(p.translations),
          });
        }
      })
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [productId, nonce]);

  const allErrors: Record<string, string> = form
    ? {
        ...priceFormErrors(form),
        ...(form.name.trim() ? {} : { name: "Enter the product name." }),
        ...pastDiscountDates(form, storedDates),
      }
    : {};
  // Validation timing: errors show after the field is left (blur) or on Submit, never while
  // a fresh form is being filled in; once shown they update live and clear when fixed.
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [submitted, setSubmitted] = useState(false);
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => submitted || touched[k])) as ReturnType<
    typeof priceFormErrors
  > & { name?: string };
  /** The API supports translations once migration 0006 is applied (records then carry the field). */
  const translationsSupported = product
    ? product.translations !== undefined
    : Boolean(categories?.some((c) => c.translations !== undefined));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setNotice(null);
    setSubmitted(true);
    const problems = Object.values(allErrors);
    if (problems.length) {
      setError(new ApiError(400, "Please correct the highlighted fields.", problems));
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
      categoryId: form.categoryId,
      summary: form.summary.trim(),
      description: form.description.trim(),
      searchTerms: form.searchTerms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      brandIds: form.brandIds,
      unit: form.unit.trim() || null,
      availability: form.availability,
      ...pricingBody(form),
      ...(translationsSupported ? { translations: fromTranslationForm(form.translations, ["searchTerms"]) } : {}),
    };
    try {
      if (!productId) {
        const created = await api.post<Product>("admin/products", body);
        if (form.published) await api.patch(`admin/products/${created.id}/publication`, { published: true });
        // Add Product → saved → back to the Products list (which confirms and highlights it).
        router.replace(`/products?created=${encodeURIComponent(created.name)}`);
        return;
      }
      let saved = await api.patch<Product>(`admin/products/${productId}`, body);
      if (form.published !== saved.isPublished) {
        saved = await api.patch<Product>(`admin/products/${productId}/publication`, { published: form.published });
      }
      setProduct(saved);
      setNotice("Changes saved.");
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <Alert onRetry={load}>{loadError}</Alert>;
  if (!form || !categories) return <Spinner />;

  if (categories.length === 0) {
    return (
      <Alert tone="info">
        Add at least one category before adding products.{" "}
        <a className="font-semibold underline" href="/categories">
          Go to Categories
        </a>
      </Alert>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const noDiscount = form.discountType === "none";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={save} noValidate={false} className="min-w-0 space-y-6">
        {notice ? <Alert tone="success">{notice}</Alert> : null}
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

        <Card className="space-y-4 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-forest">Product details</h2>
          <Field label="Product name" required error={errors.name}>
            {(p) => (
              <Input
                {...p}
                required
                maxLength={160}
                value={form.name}
                onBlur={touch("name")}
                onChange={(e) => set("name", e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              {(p) => (
                <Select {...p} required value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  <option value="">Choose a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isActive ? "" : " (inactive)"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="URL slug" hint="Optional. Created from the name when empty.">
              {(p) => (
                <Input
                  {...p}
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value.toLowerCase())}
                />
              )}
            </Field>
          </div>
          <Field label="Short summary" hint="One line shown on product cards (max 300 characters).">
            {(p) => (
              <Input {...p} maxLength={300} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
            )}
          </Field>
          <Field label="Description">
            {(p) => (
              <Textarea
                {...p}
                maxLength={5000}
                rows={6}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Search words"
            hint="Optional, comma-separated words customers might search for (e.g. rebar, steel)."
          >
            {(p) => <Input {...p} value={form.searchTerms} onChange={(e) => set("searchTerms", e.target.value)} />}
          </Field>
          {translationsSupported ? (
            <TranslationFields
              value={form.translations}
              onChange={(t) => set("translations", t)}
              fields={[
                { key: "name", label: "Product name", english: form.name, maxLength: 160 },
                { key: "summary", label: "Short summary", english: form.summary, maxLength: 300 },
                {
                  key: "description",
                  label: "Description",
                  english: form.description,
                  multiline: true,
                  maxLength: 5000,
                },
                {
                  key: "searchTerms",
                  label: "Search words",
                  english: form.searchTerms,
                  maxLength: 1500,
                  hint: "Comma-separated.",
                },
              ]}
            />
          ) : null}
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-forest">Price, discount and availability</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Enter only prices and offers the shop has approved. The website calculates the final price.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Unit of sale" hint="For example bag, sheet or piece. Optional.">
              {(p) => (
                <>
                  <Input
                    {...p}
                    list="unit-suggestions"
                    maxLength={40}
                    value={form.unit}
                    onChange={(e) => set("unit", e.target.value)}
                  />
                  <datalist id="unit-suggestions">
                    {UNIT_SUGGESTIONS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Availability" required>
              {(p) => (
                <Select
                  {...p}
                  value={form.availability}
                  onChange={(e) => set("availability", e.target.value as Availability)}
                >
                  {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
                    <option key={a} value={a}>
                      {AVAILABILITY_LABEL[a]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-1.5 text-sm font-semibold text-charcoal">Price</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { v: false, label: "Price in LKR" },
                { v: true, label: "Contact for Price" },
              ].map((o) => (
                <label
                  key={o.label}
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                    form.contactForPrice === o.v
                      ? "border-forest bg-forest-50 text-forest"
                      : "border-line-strong bg-paper text-ink-muted hover:border-brass"
                  }`}
                >
                  <input
                    type="radio"
                    name="price-mode"
                    className="size-4 accent-forest"
                    checked={form.contactForPrice === o.v}
                    onChange={() =>
                      // A Contact for Price product never shows a discount.
                      setForm({ ...form, contactForPrice: o.v, discountEnabled: o.v ? false : form.discountEnabled })
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <Field
              label="Price (LKR)"
              required={!form.contactForPrice}
              error={errors.priceLkr}
              hint={
                form.contactForPrice
                  ? "Pricing is handled through enquiry: customers see “Contact for Price”. A previously saved price is kept for staff only and returns if you switch back to a fixed price."
                  : "The original price, e.g. 2500.00"
              }
            >
              {(p) => (
                <div className="relative max-w-xs">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-ink-muted">
                    LKR
                  </span>
                  <Input
                    {...p}
                    inputMode="decimal"
                    autoComplete="off"
                    className="pl-12 disabled:cursor-not-allowed disabled:bg-cream disabled:text-ink-muted"
                    disabled={form.contactForPrice}
                    placeholder={form.contactForPrice ? "Contact for Price" : "0.00"}
                    onBlur={touch("priceLkr")}
                    value={form.priceLkr}
                    onChange={(e) => set("priceLkr", e.target.value.replace(/[,\s]/g, ""))}
                  />
                </div>
              )}
            </Field>
          </fieldset>

          <fieldset
            disabled={form.contactForPrice}
            className="space-y-4 rounded-2xl border border-line/70 bg-cream/40 p-4 disabled:opacity-60"
          >
            <legend className="px-1 text-sm font-semibold text-charcoal">Discount</legend>
            {form.contactForPrice ? (
              <p className="text-sm text-ink-muted">Discounts are not shown for Contact for Price products.</p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Discount type" optional={false}>
                {(p) => (
                  <Select
                    {...p}
                    value={form.discountType}
                    onChange={(e) => {
                      const t = e.target.value as DiscountType;
                      setForm({ ...form, discountType: t, ...(t === "none" ? { discountEnabled: false } : {}) });
                    }}
                  >
                    <option value="none">No discount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed amount (LKR)</option>
                  </Select>
                )}
              </Field>
              <Field
                label={form.discountType === "fixed" ? "Discount amount (LKR)" : "Discount value (%)"}
                required={!noDiscount}
                error={errors.discountValue}
              >
                {(p) => (
                  <Input
                    {...p}
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={noDiscount}
                    value={noDiscount ? "" : form.discountValue}
                    onBlur={touch("discountValue")}
                    onChange={(e) => set("discountValue", e.target.value.replace(/[,\s%]/g, ""))}
                  />
                )}
              </Field>
            </div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-forest"
                disabled={noDiscount}
                checked={!noDiscount && form.discountEnabled}
                onChange={(e) => {
                  set("discountEnabled", e.target.checked);
                  touch("discountEnabled")();
                }}
              />
              <span>
                <span className="block font-semibold text-charcoal">Discount enabled</span>
                <span className="block text-sm text-ink-muted">
                  Customers see the offer only while it is enabled and within its dates.
                </span>
                {errors.discountEnabled ? (
                  <span className="block text-xs font-semibold text-logo-red">{errors.discountEnabled}</span>
                ) : null}
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Start date"
                hint="Optional (Sri Lanka time). Today or later."
                error={(errors as Record<string, string | undefined>).discountStartsOn}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    disabled={noDiscount}
                    min={storedDates.start && storedDates.start < today ? storedDates.start : today}
                    value={form.discountStartsOn}
                    onBlur={touch("discountStartsOn")}
                    onChange={(e) => set("discountStartsOn", e.target.value)}
                  />
                )}
              </Field>
              <Field label="End date" hint="Optional. The offer ends after this day." error={errors.discountEndsOn}>
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    disabled={noDiscount}
                    min={form.discountStartsOn && form.discountStartsOn > today ? form.discountStartsOn : today}
                    value={form.discountEndsOn}
                    onBlur={touch("discountEndsOn")}
                    onChange={(e) => set("discountEndsOn", e.target.value)}
                  />
                )}
              </Field>
            </div>
          </fieldset>
        </Card>

        <Card className="p-5 sm:p-6">
          <fieldset>
            <legend className="font-display text-lg font-semibold text-forest">Brands</legend>
            <p className="mt-1 text-sm text-ink-muted">
              Link a brand only when the shop has confirmed this product is that brand.
            </p>
            {brands.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {brands.map((b) => {
                  const on = form.brandIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                        on
                          ? "border-forest bg-forest-50 text-forest"
                          : "border-line-strong bg-paper text-ink-muted hover:border-brass"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-forest"
                        checked={on}
                        onChange={() =>
                          set("brandIds", on ? form.brandIds.filter((x) => x !== b.id) : [...form.brandIds, b.id])
                        }
                      />
                      {b.name}
                      {b.isActive ? null : <span className="text-xs font-normal">(inactive)</span>}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">No brands yet.</p>
            )}
          </fieldset>
        </Card>

        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => set("published", e.target.checked)}
              className="mt-1 size-4 accent-forest"
            />
            <span>
              <span className="block font-semibold text-charcoal">Published</span>
              <span className="block text-sm text-ink-muted">
                Visible on the public website when its category is active.
              </span>
            </span>
          </label>
          <Button type="submit" loading={saving} icon={<Save aria-hidden="true" className="size-4" />}>
            {productId ? "Save Changes" : "Create Product"}
          </Button>
        </Card>
      </form>

      <aside className="min-w-0 space-y-6">
        <PricePreviewCard form={form} hasErrors={Object.keys(allErrors).length > 0} />
        {product ? (
          <ImageManager product={product} onChange={(images) => setProduct({ ...product, images })} />
        ) : (
          <Card className="p-5 text-sm text-ink-muted">
            <h2 className="font-display text-lg font-semibold text-forest">Images</h2>
            <p className="mt-2">Create the product first, then add images.</p>
          </Card>
        )}
        {product ? (
          <p className="text-xs text-ink-muted">
            Status: {product.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="gold">Draft</Badge>}
          </p>
        ) : null}
        {product ? <DeleteProductCard product={product} /> : null}
      </aside>
    </div>
  );
}

/**
 * Live preview from the API's price calculation (the same one the public
 * website uses), refreshed as the values change.
 */
function PricePreviewCard({ form, hasErrors }: { form: Form; hasErrors: boolean }) {
  const body = pricingBody(form);
  const key = JSON.stringify(body);
  const ready = !hasErrors && !form.contactForPrice && Boolean(body.priceLkr);
  const [result, setResult] = useState<{ key: string; data?: PricePreview; error?: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const t = setTimeout(() => {
      api
        .post<PricePreview>("admin/products/price-preview", JSON.parse(key))
        .then((data) => alive && setResult({ key, data }))
        .catch((e: Error) => alive && setResult({ key, error: e.message }));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key, ready]);

  const current = result?.key === key ? result : null;
  const data = current?.data;
  const shown = data?.offer ?? data?.price ?? null;

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold text-forest">Price preview</h2>
      <div aria-live="polite" className="mt-3 text-sm" data-testid="price-preview">
        {form.contactForPrice ? (
          <p className="rounded-xl bg-cream px-4 py-3 text-charcoal">
            Customers see <strong>Contact for Price</strong>. No price or discount is shown.
          </p>
        ) : hasErrors ? (
          <p className="text-logo-red">Correct the highlighted price details to see the preview.</p>
        ) : !body.priceLkr ? (
          <p className="text-ink-muted">Enter a price to see the preview.</p>
        ) : current?.error ? (
          <p className="text-logo-red">{current.error}</p>
        ) : data && !data.valid ? (
          <ul className="list-disc pl-4 text-logo-red">
            {data.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : data && shown ? (
          <>
            <dl className="divide-y divide-line/60 rounded-xl border border-line/70">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-ink-muted">Original Price</dt>
                <dd className="font-semibold text-charcoal">{formatLkr(shown.original!)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-ink-muted">Discount Amount</dt>
                <dd className="font-semibold text-logo-red">
                  {shown.discount
                    ? `− ${formatLkr(shown.discount.amount)}${
                        shown.discount.type === "percentage" ? ` (${formatPercent(shown.discount.value)})` : ""
                      }`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 bg-forest-50 px-4 py-3">
                <dt className="font-semibold text-forest">Final Selling Price</dt>
                <dd className="font-display text-lg font-semibold text-forest">{formatLkr(shown.final!)}</dd>
              </div>
            </dl>
            {data.discountStatus && data.discountStatus !== "none" ? (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-ink-muted">
                <Badge tone={data.discountStatus === "active" ? "green" : "gold"}>
                  {DISCOUNT_STATUS_LABEL[data.discountStatus]}
                </Badge>
                {data.discountStatus !== "active" && data.price?.final ? (
                  <span>Customers currently see {formatLkr(data.price.final)}.</span>
                ) : null}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-ink-muted">Calculating…</p>
        )}
      </div>
    </Card>
  );
}

function ImageManager({ product, onChange }: { product: Product; onChange: (images: Product["images"]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [asMain, setAsMain] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<Product["images"][number] | null>(null);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; alt: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  /** Server order: main image first. */
  const refresh = async () => onChange((await api.get<Product>(`admin/products/${product.id}`)).images);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setError("Choose a JPEG, PNG or WebP image.");
    if (f.size > MAX_BYTES) return setError("The image is larger than 5 MB. Please choose a smaller file.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (!alt) setAlt(product.name);
  };

  const upload = async () => {
    if (!file) return;
    if (!alt.trim()) return setError("Describe the image (alt text) for people who cannot see it.");
    setError(null);
    setProgress(0);
    try {
      await uploadImage(product.id, file, alt.trim(), setProgress, asMain);
      await refresh();
      setFile(null);
      setPreview(null);
      setAlt("");
      setAsMain(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const makeMain = async (imageId: string) => {
    setBusy(imageId);
    setError(null);
    try {
      await api.patch(`admin/products/${product.id}/images/${imageId}`, { isMain: true });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveAlt = async () => {
    if (!editing) return;
    if (!editing.alt.trim()) return setError("Alt text cannot be empty.");
    setBusy(editing.id);
    try {
      await api.patch(`admin/products/${product.id}/images/${editing.id}`, { altText: editing.alt.trim() });
      await refresh();
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = async () => {
    if (!remove) return;
    setRemoving(true);
    try {
      await api.del(`admin/products/${product.id}/images/${remove.id}`);
      await refresh();
      setRemove(null);
    } catch (e) {
      setError((e as Error).message);
      setRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  const iconBtn = "inline-flex size-8 items-center justify-center rounded-full bg-paper/95 shadow disabled:opacity-50";

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold text-forest">Images</h2>
      <p className="mt-1 text-xs text-ink-muted">
        JPEG, PNG or WebP up to 5 MB. Images are checked and converted on the server. The main image is shown on product
        cards; the others appear on the product page.
      </p>

      {product.images.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {product.images.map((img) => (
            <li
              key={img.id}
              className={`relative overflow-hidden rounded-xl border bg-cream ${
                img.isMain ? "border-brass ring-2 ring-brass/40" : "border-line/70"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin image via the admin gateway */}
              <img
                src={imageUrl(product.id, img.id)}
                alt={img.altText}
                width={img.width}
                height={img.height}
                className="aspect-square w-full object-cover"
              />
              {img.isMain ? (
                <span className="absolute top-2 left-2 rounded-full bg-forest px-2 py-0.5 text-[0.7rem] font-semibold text-cream">
                  Main
                </span>
              ) : null}
              <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                {img.isMain ? null : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => makeMain(img.id)}
                    className={`${iconBtn} text-brass hover:bg-brass-100`}
                  >
                    <Star aria-hidden="true" className="size-4" />
                    <span className="sr-only">Make main image: {img.altText}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setEditing({ id: img.id, alt: img.altText })}
                  className={`${iconBtn} text-forest hover:bg-forest-50`}
                >
                  <Pencil aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">Edit alt text: {img.altText}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRemove(img)}
                  className={`${iconBtn} text-logo-red hover:bg-danger-50`}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  <span className="sr-only">Remove image: {img.altText}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
          No images yet. The first image becomes the main image.
        </p>
      )}

      <div className="mt-5 space-y-3 border-t border-line/70 pt-5">
        {error ? <Alert>{error}</Alert> : null}
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-brass/50 bg-cream/50 px-4 py-5 text-center text-sm font-semibold text-forest hover:border-brass">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL)
            <img src={preview} alt="Selected image preview" className="max-h-40 w-auto rounded-lg object-contain" />
          ) : (
            <ImagePlus aria-hidden="true" className="size-6 text-brass" />
          )}
          {file ? file.name : "Choose an image"}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {file ? (
          <>
            <Field label="Alt text" required hint="Describe what the image shows.">
              {(p) => <Input {...p} maxLength={250} value={alt} onChange={(e) => setAlt(e.target.value)} />}
            </Field>
            {product.images.length ? (
              <label className="flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  className="size-4 accent-forest"
                  checked={asMain}
                  onChange={(e) => setAsMain(e.target.checked)}
                />
                Make this the main image (replaces the current main image on cards)
              </label>
            ) : null}
            {progress !== null ? (
              <div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-cream-deep"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  aria-label="Upload progress"
                >
                  <div
                    className="h-full bg-gradient-to-r from-forest to-brass transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Processing…"}
                </p>
              </div>
            ) : null}
            <Button
              type="button"
              onClick={upload}
              loading={progress !== null}
              icon={<Upload aria-hidden="true" className="size-4" />}
              className="w-full"
            >
              Upload Image
            </Button>
          </>
        ) : null}
      </div>

      <Dialog
        open={editing !== null}
        title="Edit alt text"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button onClick={saveAlt} loading={busy !== null}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Alt text" required hint="Describe what the image shows.">
          {(p) => (
            <Input
              {...p}
              maxLength={250}
              value={editing?.alt ?? ""}
              onChange={(e) => editing && setEditing({ ...editing, alt: e.target.value })}
            />
          )}
        </Field>
      </Dialog>

      <ConfirmDialog
        open={remove !== null}
        title="Remove image?"
        message={
          remove?.isMain && product.images.length > 1
            ? "This is the main image. It will be deleted and the next image becomes the main image. This cannot be undone."
            : "The image will be deleted from the product and the website. This cannot be undone."
        }
        confirmLabel="Remove"
        danger
        busy={removing}
        onConfirm={confirmRemove}
        onClose={() => setRemove(null)}
      />
    </Card>
  );
}
