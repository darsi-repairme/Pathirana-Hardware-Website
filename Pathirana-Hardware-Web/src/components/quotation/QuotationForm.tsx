"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CloudOff, ImagePlus, Phone, Plus, Send, Trash2, X } from "lucide-react";
import { business, telHref } from "@/content/business";
import { apiGet, getApiBase, type DeliveryAreaList } from "@/lib/api";
import {
  MAX_ITEMS,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_TYPES,
  prepareImage,
  quotationWhatsappText,
  submitQuotation,
  SubmitError,
  UNIT_SUGGESTIONS,
  validate,
  whatsappTextHref,
  type FieldErrors,
  type QuotationForm as Form,
  type QuotationItem,
} from "@/lib/quotation";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

const control =
  "w-full rounded-xl border border-line-strong bg-white px-4 text-[0.95rem] text-charcoal transition-[border-color,box-shadow] duration-300 outline-none hover:border-brass focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.2)] aria-[invalid=true]:border-logo-red";
const input = `${control} h-12`;

const emptyItem = (): QuotationItem => ({ productName: "", quantity: "", unit: "" });
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16),
      );

type Photo = { id: string; file: File; url: string };
type Done = { reference: string; photoCount: number; duplicate: boolean; text: string; autoOpened: boolean };

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-charcoal">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-logo-red">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-ink-muted"> (optional)</span>
        )}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-logo-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, hint: boolean, error?: string) =>
  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

/**
 * Request a Quotation (Batch 5B). No login. The request is saved to the
 * website database first (with a reference number); only then does the
 * customer open WhatsApp with a ready, editable message and tap Send
 * themselves. Photos stay private (staff-only) and are referred to by the
 * quotation reference — WhatsApp links cannot attach files.
 */
export function QuotationForm() {
  const id = useId();
  const params = useSearchParams();
  const prefill = params.get("product")?.slice(0, 160) ?? "";
  const prefillSlug = params.get("slug") ?? "";
  const enabled = getApiBase() !== null;

  const [form, setForm] = useState<Form>(() => ({
    customerName: "",
    phone: "",
    location: "",
    otherLocation: "",
    fulfilment: "delivery",
    deliveryAddress: "",
    email: "",
    notes: "",
    contactConsent: false,
    items: [
      prefill
        ? {
            productName: prefill,
            quantity: "",
            unit: "",
            ...(/^[a-z0-9-]{1,80}$/.test(prefillSlug) ? { productSlug: prefillSlug } : {}),
          }
        : emptyItem(),
    ],
  }));
  const [areas, setAreas] = useState<string[] | null>(null);
  const [areasError, setAreasError] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [key, setKey] = useState(newKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    apiGet<DeliveryAreaList>("/api/v1/delivery-areas", ctrl.signal)
      .then((r) => setAreas(r.items.map((a) => a.name)))
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setAreas([]);
          setAreasError(true);
        }
      });
    return () => ctrl.abort();
  }, [enabled]);

  // Release preview URLs when the form goes away.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const setItem = (i: number, patch: Partial<QuotationItem>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[`items.${i}.${k}`];
      return next;
    });
  };
  const addItem = () => {
    setForm((f) => (f.items.length >= MAX_ITEMS ? f : { ...f, items: [...f.items, emptyItem()] }));
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLInputElement>(`[data-item-row]:last-of-type input[name="productName"]`)
        ?.focus(),
    );
  };
  const removeItem = (i: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
    setErrors({});
  };

  const addPhotos = (list: FileList | null) => {
    setPhotoError(null);
    if (!list) return;
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_PHOTOS) {
        setPhotoError(`You can attach up to ${MAX_PHOTOS} photos.`);
        break;
      }
      if (!PHOTO_TYPES.includes(file.type)) {
        setPhotoError(`“${file.name}” is not a JPEG, PNG or WebP photo.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(`“${file.name}” is larger than 5 MB.`);
        continue;
      }
      next.push({ id: newKey(), file, url: URL.createObjectURL(file) });
    }
    setPhotos(next);
    if (fileRef.current) fileRef.current.value = "";
  };
  const removePhoto = (pid: string) => {
    setPhotos((ps) => {
      const p = ps.find((x) => x.id === pid);
      if (p) URL.revokeObjectURL(p.url);
      return ps.filter((x) => x.id !== pid);
    });
    setPhotoError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const found = validate(
      form,
      photos.map((p) => p.file),
    );
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setSubmitting(true);
    try {
      const files = await Promise.all(photos.map((p) => prepareImage(p.file)));
      const result = await submitQuotation(form, files, key);
      const text = quotationWhatsappText(result.reference, form, result.photoCount);
      // Try to open WhatsApp; browsers often block this after a network request, so the
      // success panel always offers the button as well.
      let autoOpened = false;
      try {
        const w = window.open(whatsappTextHref(text), "_blank");
        if (w) {
          w.opener = null;
          autoOpened = true;
        }
      } catch {
        /* blocked */
      }
      setDone({ ...result, text, autoOpened });
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch (err) {
      setServerError(err instanceof SubmitError ? err.message : "Your request could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setForm((f) => ({ ...f, items: [emptyItem()], notes: "", contactConsent: false }));
    setKey(newKey());
    setDone(null);
    setErrors({});
  };

  if (done) {
    const href = whatsappTextHref(done.text);
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        data-quotation-state="saved"
        className="rounded-[var(--radius-panel)] border border-line/70 bg-white p-6 shadow-[var(--shadow-card)] outline-none sm:p-10"
      >
        <CheckCircle2 aria-hidden="true" className="size-10 text-forest" />
        <h2 className="mt-4 font-display text-3xl font-semibold text-forest">Quotation request saved</h2>
        <p className="mt-3 text-lg text-charcoal">
          Your reference number is{" "}
          <strong data-quotation-reference className="font-mono tracking-wide whitespace-nowrap text-forest">
            {done.reference}
          </strong>
          .
        </p>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-muted">
          {done.duplicate
            ? "This request was already saved earlier — the same reference is shown. "
            : "Our team can now see your request" +
              (done.photoCount
                ? ` and your ${done.photoCount} reference photo${done.photoCount === 1 ? "" : "s"}`
                : "") +
              ". "}
          To send it to us on WhatsApp, open WhatsApp, check the message and tap <strong>Send</strong>. The message is
          only sent when you tap Send.
        </p>
        {done.autoOpened ? (
          <p className="mt-2 text-sm text-ink-muted">
            WhatsApp was opened in a new tab. If you do not see it, use the button below.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-quotation-whatsapp
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#177a42] px-6 font-semibold text-white transition-colors hover:bg-[#11653a]"
          >
            <WhatsAppIcon className="size-5" /> Open WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            href={telHref}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-forest/25 px-6 font-semibold text-forest hover:border-brass hover:bg-cream"
          >
            <Phone aria-hidden="true" className="size-4" /> Call {business.phone.display}
          </a>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-semibold text-forest underline underline-offset-4"
          >
            Start a new request
          </button>
        </div>
        {done.photoCount ? (
          <p className="mt-6 text-sm text-ink-muted">
            WhatsApp cannot attach your photos automatically — they are saved with reference {done.reference}, which the
            message mentions.
          </p>
        ) : null}
      </div>
    );
  }

  if (!enabled) {
    return (
      <div
        className="rounded-[var(--radius-panel)] border border-line/70 bg-white p-8 text-center"
        data-quotation-state="unavailable"
      >
        <CloudOff aria-hidden="true" className="mx-auto size-9 text-brass-ink" />
        <h2 className="mt-3 font-display text-2xl text-forest">Online quotation requests are not available</h2>
        <p className="mt-2 text-ink-muted">Please call or WhatsApp the store with the items you need.</p>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      data-quotation-state={submitting ? "submitting" : "form"}
      aria-busy={submitting || undefined}
      className="space-y-8 rounded-[var(--radius-panel)] border border-line/70 bg-white p-5 shadow-[var(--shadow-card)] sm:p-8 lg:p-10"
    >
      <p className="text-sm text-ink-muted">
        Fields marked <span className="text-logo-red">*</span> are required. No account needed.
      </p>

      {/* Contact details */}
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-display text-xl font-semibold text-forest">Your details</legend>
        <Field id={`${id}-name`} label="Name" required error={err("customerName")}>
          <input
            id={`${id}-name`}
            name="customerName"
            autoComplete="name"
            maxLength={120}
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            aria-invalid={!!err("customerName")}
            aria-describedby={describedBy(`${id}-name`, false, err("customerName"))}
            className={input}
          />
        </Field>
        <Field
          id={`${id}-phone`}
          label="Phone / WhatsApp number"
          required
          error={err("phone")}
          hint="Your mobile or WhatsApp number, including the first 0 (or +94)."
        >
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={24}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            aria-invalid={!!err("phone")}
            aria-describedby={describedBy(`${id}-phone`, true, err("phone"))}
            className={input}
          />
        </Field>
        <Field id={`${id}-email`} label="Email" error={err("email")}>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!err("email")}
            aria-describedby={describedBy(`${id}-email`, false, err("email"))}
            className={input}
          />
        </Field>
        <Field
          id={`${id}-location`}
          label="Location"
          required
          error={err("location")}
          hint={areasError ? "Our area list could not be loaded — choose Other and type your town." : undefined}
        >
          <select
            id={`${id}-location`}
            name="location"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            aria-invalid={!!err("location")}
            aria-describedby={describedBy(`${id}-location`, areasError, err("location"))}
            className={`${input} appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%230f5d3a%22%3E%3Cpath%20d%3D%22M5.5%207.5%2010%2012l4.5-4.5%22%20stroke%3D%22%230f5d3a%22%20stroke-width%3D%221.8%22%20fill%3D%22none%22/%3E%3C/svg%3E')] bg-[length:1.25rem] bg-[right_0.9rem_center] bg-no-repeat pr-10`}
          >
            <option value="">{areas === null ? "Loading areas…" : "Choose your area"}</option>
            {(areas ?? []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </Field>
        {form.location === "Other" ? (
          <Field id={`${id}-other`} label="Your town or area" required error={err("otherLocation")}>
            <input
              id={`${id}-other`}
              name="otherLocation"
              maxLength={120}
              autoComplete="address-level2"
              value={form.otherLocation}
              onChange={(e) => set("otherLocation", e.target.value)}
              aria-invalid={!!err("otherLocation")}
              aria-describedby={describedBy(`${id}-other`, false, err("otherLocation"))}
              className={input}
            />
          </Field>
        ) : null}
      </fieldset>

      {/* Items */}
      <fieldset>
        <legend className="mb-4 font-display text-xl font-semibold text-forest">Products you need</legend>
        <datalist id={`${id}-units`}>
          {UNIT_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <ol className="space-y-4">
          {form.items.map((it, i) => {
            const base = `${id}-item-${i}`;
            return (
              <li
                key={i}
                data-item-row
                className="grid gap-3 rounded-2xl border border-line/70 bg-cream/50 p-4 sm:grid-cols-[minmax(0,1fr)_7.5rem_8rem_auto] sm:items-start"
              >
                <Field id={`${base}-name`} label={`Product ${i + 1}`} required error={err(`items.${i}.productName`)}>
                  <input
                    id={`${base}-name`}
                    name="productName"
                    maxLength={160}
                    value={it.productName}
                    onChange={(e) => setItem(i, { productName: e.target.value, productSlug: undefined })}
                    aria-invalid={!!err(`items.${i}.productName`)}
                    aria-describedby={describedBy(`${base}-name`, false, err(`items.${i}.productName`))}
                    className={input}
                  />
                </Field>
                <Field id={`${base}-qty`} label="Quantity" required error={err(`items.${i}.quantity`)}>
                  <input
                    id={`${base}-qty`}
                    name="quantity"
                    inputMode="decimal"
                    maxLength={13}
                    value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })}
                    aria-invalid={!!err(`items.${i}.quantity`)}
                    aria-describedby={describedBy(`${base}-qty`, false, err(`items.${i}.quantity`))}
                    className={input}
                  />
                </Field>
                <Field id={`${base}-unit`} label="Unit">
                  <input
                    id={`${base}-unit`}
                    name="unit"
                    list={`${id}-units`}
                    maxLength={40}
                    placeholder="bag, piece…"
                    value={it.unit}
                    onChange={(e) => setItem(i, { unit: e.target.value })}
                    className={`${input} placeholder:text-ink-muted`}
                  />
                </Field>
                {form.items.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 self-end rounded-full px-3 text-sm font-semibold text-logo-red hover:bg-white sm:mb-0.5"
                  >
                    <Trash2 aria-hidden="true" className="size-4" /> Remove
                    <span className="sr-only"> product {i + 1}</span>
                  </button>
                ) : (
                  <span aria-hidden="true" className="hidden sm:block" />
                )}
              </li>
            );
          })}
        </ol>
        {form.items.length < MAX_ITEMS ? (
          <button
            type="button"
            onClick={addItem}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-forest/25 px-5 font-semibold text-forest transition-colors hover:border-brass hover:bg-cream"
          >
            <Plus aria-hidden="true" className="size-4" /> Add another product
          </button>
        ) : null}
      </fieldset>

      {/* Delivery */}
      <fieldset>
        <legend className="mb-4 font-display text-xl font-semibold text-forest">Delivery or collection</legend>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["delivery", "Delivery to my site"],
              ["collection", "I will collect from the store"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-white px-4 has-[:checked]:border-forest has-[:checked]:bg-forest-50"
            >
              <input
                type="radio"
                name="fulfilment"
                value={value}
                checked={form.fulfilment === value}
                onChange={() => set("fulfilment", value)}
                className="size-4 accent-forest"
              />
              <span className="font-semibold text-charcoal">{label}</span>
            </label>
          ))}
        </div>
        {form.fulfilment === "delivery" ? (
          <div className="mt-4">
            <Field id={`${id}-address`} label="Delivery address" required error={err("deliveryAddress")}>
              <textarea
                id={`${id}-address`}
                name="deliveryAddress"
                rows={3}
                maxLength={500}
                autoComplete="street-address"
                value={form.deliveryAddress}
                onChange={(e) => set("deliveryAddress", e.target.value)}
                aria-invalid={!!err("deliveryAddress")}
                aria-describedby={describedBy(`${id}-address`, false, err("deliveryAddress"))}
                className={`${control} py-3`}
              />
            </Field>
          </div>
        ) : null}
      </fieldset>

      {/* Notes + photos */}
      <fieldset className="space-y-5">
        <legend className="mb-4 font-display text-xl font-semibold text-forest">More details</legend>
        <Field id={`${id}-notes`} label="Additional notes">
          <textarea
            id={`${id}-notes`}
            name="notes"
            rows={4}
            maxLength={2000}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className={`${control} py-3`}
          />
        </Field>
        <div>
          <p id={`${id}-photos-label`} className="mb-1.5 text-sm font-semibold text-charcoal">
            Reference photos <span className="font-normal text-ink-muted">(optional)</span>
          </p>
          <p className="mb-3 text-xs text-ink-muted">
            Up to {MAX_PHOTOS} photos (JPEG, PNG or WebP, 5 MB each) — e.g. the item, a label or your site. Only our
            staff can see them.
          </p>
          {photos.length ? (
            <ul aria-labelledby={`${id}-photos-label`} className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((p, i) => (
                <li key={p.id} className="relative overflow-hidden rounded-xl border border-line/70 bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
                  <img src={p.url} alt={`Selected photo ${i + 1}`} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="absolute top-1.5 right-1.5 inline-flex size-9 items-center justify-center rounded-full bg-white/95 text-logo-red shadow"
                  >
                    <X aria-hidden="true" className="size-4" />
                    <span className="sr-only">Remove photo {i + 1}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {photos.length < MAX_PHOTOS ? (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-dashed border-brass/60 bg-cream/60 px-5 font-semibold text-forest focus-within:shadow-[0_0_0_3px_rgb(15_93_58/0.2)] hover:border-brass">
              <ImagePlus aria-hidden="true" className="size-5 text-brass-ink" />
              {photos.length ? "Add more photos" : "Add photos"}
              <input
                ref={fileRef}
                type="file"
                name="photos"
                accept={PHOTO_TYPES.join(",")}
                multiple
                className="sr-only"
                onChange={(e) => addPhotos(e.target.files)}
              />
            </label>
          ) : null}
          {photoError || err("photos") ? (
            <p role="alert" className="mt-2 text-sm font-semibold text-logo-red">
              {photoError ?? err("photos")}
            </p>
          ) : null}
        </div>
      </fieldset>

      {/* Consent + submit */}
      <div className="space-y-5 border-t border-line/70 pt-6">
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="contactConsent"
              checked={form.contactConsent}
              onChange={(e) => set("contactConsent", e.target.checked)}
              aria-invalid={!!err("contactConsent")}
              aria-describedby={err("contactConsent") ? `${id}-consent-error` : undefined}
              className="mt-1 size-5 shrink-0 accent-forest"
            />
            <span className="text-charcoal">
              I agree that {business.shortName} may contact me by phone or WhatsApp about this quotation request.
              <span aria-hidden="true" className="text-logo-red">
                {" "}
                *
              </span>
            </span>
          </label>
          {err("contactConsent") ? (
            <p id={`${id}-consent-error`} className="mt-1.5 text-sm font-semibold text-logo-red">
              {err("contactConsent")}
            </p>
          ) : null}
        </div>
        {serverError ? (
          <p role="alert" className="rounded-xl border border-logo-red/30 bg-white p-4 font-semibold text-logo-red">
            {serverError}
          </p>
        ) : null}
        {Object.keys(errors).some((k) => errors[k]) ? (
          <p role="alert" className="text-sm font-semibold text-logo-red">
            Please check the highlighted fields.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest px-8 font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-70 sm:w-auto"
        >
          <Send aria-hidden="true" className="size-4" />
          {submitting ? "Saving your request…" : "Submit Quotation Request"}
        </button>
        <p className="text-xs text-ink-muted">
          Your request is saved with a reference number. You can then send it to us on WhatsApp. This is a request for
          prices — not an order, and no payment is taken.
        </p>
      </div>
    </form>
  );
}
