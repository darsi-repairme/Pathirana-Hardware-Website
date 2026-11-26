"use client";

import { useEffect, useId, useMemo, useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CloudOff, ImagePlus, Phone, Plus, Send, Trash2, X } from "lucide-react";
import { business, telHref } from "@/content/business";
import { apiGet, getApiBase, type DeliveryArea, type DeliveryAreaList } from "@/lib/api";
import {
  MAX_ITEMS,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_TYPES,
  PROMO_CODE,
  checkPromoCode,
  digitsOnly,
  prepareImage,
  QUOTATION_CONFIRMATION,
  QUOTATION_NOT_AN_ORDER,
  quotationWhatsappText,
  submitQuotation,
  SubmitError,
  UNIT_SUGGESTIONS,
  validate,
  whatsappTextHref,
  type FieldErrors,
  type PromoStatus,
  type QuotationForm as Form,
  type QuotationItem,
} from "@/lib/quotation";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { T, TRich, useDynamicText, useLocale, useT } from "@/i18n/I18nProvider";

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
  const t = useT();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-charcoal">
        {t(label)}
        {required ? (
          <span aria-hidden="true" className="text-logo-red">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-ink-muted"> ({t("optional")})</span>
        )}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {typeof hint === "string" ? t(hint) : hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-logo-red">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}

/** What a checked promo code means for the customer (the request is saved either way). */
const PROMO_MESSAGE: Record<PromoStatus, string> = {
  valid: "This code matches a current offer. Our staff will confirm it with your quotation.",
  not_eligible: "This code is for other products. You can still send the request; our staff will check it.",
  expired: "This offer has ended. You can still send the request without it.",
  unknown: "We could not find a current offer with this code. Please check it, or send the request without it.",
};

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
  // From the header's Offers panel: the copied promo code (format-checked; the API checks it again).
  const prefillPromo = (params.get("promo") ?? "").trim().toUpperCase().slice(0, 32);
  const enabled = getApiBase() !== null;
  const { t, locale } = useLocale();
  const pick = useDynamicText();

  const [form, setForm] = useState<Form>(() => ({
    customerName: "",
    phone: "",
    location: "",
    otherLocation: "",
    fulfilment: "delivery",
    deliveryAddress: "",
    email: "",
    notes: "",
    promoCode: PROMO_CODE.test(prefillPromo) ? prefillPromo : "",
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
  const [areas, setAreas] = useState<DeliveryArea[] | null>(null);
  const [promo, setPromo] = useState<PromoStatus | null>(null);
  const [areasError, setAreasError] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** Fields the visitor has left at least once, and whether Submit was pressed (validation timing). */
  const [touched, setTouched] = useState<Record<string, true>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [key, setKey] = useState(newKey);
  const [honeypot, setHoneypot] = useState("");
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
      .then((r) => setAreas(r.items))
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

  const liveErrors = useMemo<FieldErrors>(
    () =>
      validate(
        form,
        photos.map((p) => p.file),
      ),
    [form, photos],
  );

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setItem = (i: number, patch: Partial<QuotationItem>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
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
    // Row positions shift: only keep "left" marks for the visitor's own details.
    setTouched((t) => Object.fromEntries(Object.entries(t).filter(([k]) => !k.startsWith("items."))));
  };

  const addPhotos = (list: FileList | null) => {
    setPhotoError(null);
    if (!list) return;
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_PHOTOS) {
        setPhotoError(t("You can attach up to {n} photos.", { n: MAX_PHOTOS }));
        break;
      }
      if (!PHOTO_TYPES.includes(file.type)) {
        setPhotoError(t("“{file}” is not a JPEG, PNG or WebP photo.", { file: file.name }));
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(t("“{file}” is larger than 5 MB.", { file: file.name }));
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
    setSubmitted(true);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    if (submitting) return; // never send the same request twice
    setSubmitting(true);
    // Reserve the WhatsApp tab NOW, inside the tap/click, so popup blockers allow it. It stays
    // blank until the request is confirmed saved, and is closed again if saving fails.
    let waTab: Window | null = null;
    try {
      waTab = window.open("", "_blank");
      if (waTab) {
        waTab.opener = null;
        waTab.document.title = "WhatsApp";
        waTab.document.body.textContent = t("Saving your quotation request… WhatsApp opens here once it is saved.");
      }
    } catch {
      waTab = null;
    }
    try {
      const files = await Promise.all(photos.map((p) => prepareImage(p.file)));
      const result = await submitQuotation(form, files, key, honeypot);
      const chosen = areas?.find((a) => a.name === form.location);
      const text = quotationWhatsappText(
        result.reference,
        form,
        result.photoCount,
        locale,
        chosen ? pick(chosen.name, chosen.translations, "name") : undefined,
      );
      // Saved — only now point the reserved tab at WhatsApp. If the browser blocked it, the
      // success panel offers "Continue to WhatsApp" (a single tab either way).
      let autoOpened = false;
      if (waTab && !waTab.closed) {
        try {
          waTab.location.href = whatsappTextHref(text);
          autoOpened = true;
        } catch {
          autoOpened = false;
        }
      }
      setDone({ ...result, text, autoOpened });
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch (err) {
      try {
        waTab?.close();
      } catch {
        /* already closed */
      }
      setServerError(
        err instanceof SubmitError ? t(err.message) : t("Your request could not be saved. Please try again."),
      );
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
    setTouched({});
    setSubmitted(false);
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
        <h2 className="mt-4 font-display text-3xl font-semibold text-forest">
          <T>Quotation request received</T>
        </h2>
        <p data-quotation-confirmation className="mt-3 max-w-2xl text-lg leading-relaxed text-charcoal">
          <T>{QUOTATION_CONFIRMATION}</T>
        </p>
        <p className="mt-3 text-lg text-charcoal">
          <TRich
            nodes={{
              reference: (
                <strong data-quotation-reference className="font-mono tracking-wide whitespace-nowrap text-forest">
                  {done.reference}
                </strong>
              ),
            }}
          >
            {"Your reference number is {reference}."}
          </TRich>
        </p>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-muted">
          {done.duplicate
            ? t("This request was already saved earlier — the same reference is shown.")
            : done.photoCount === 1
              ? t("Our team can now see your request and your reference photo.")
              : done.photoCount
                ? t("Our team can now see your request and your {n} reference photos.", { n: done.photoCount })
                : t("Our team can now see your request.")}{" "}
          {t(
            "You can also send it to us on WhatsApp: open WhatsApp, check the message and tap Send. The message is only sent when you tap Send.",
          )}
        </p>
        <p
          data-quotation-not-order
          className="mt-3 max-w-2xl rounded-xl border border-brass/40 bg-cream/70 px-4 py-3 text-sm font-semibold text-charcoal"
        >
          <T>{QUOTATION_NOT_AN_ORDER}</T>
        </p>
        {done.autoOpened ? (
          <p className="mt-2 text-sm text-ink-muted">
            <T>WhatsApp was opened in a new tab with your message ready. If you do not see it, use the button below.</T>
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
            <WhatsAppIcon className="size-5" /> {t("Continue to WhatsApp")}
            <span className="sr-only"> {t("(opens in a new tab)")}</span>
          </a>
          <a
            href={telHref}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-forest/25 px-6 font-semibold text-forest hover:border-brass hover:bg-cream"
          >
            <Phone aria-hidden="true" className="size-4" /> {t("Call {phone}", { phone: business.phone.display })}
          </a>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-semibold text-forest underline underline-offset-4"
          >
            {t("Start a new request")}
          </button>
        </div>
        {done.photoCount ? (
          <p className="mt-6 text-sm text-ink-muted">
            {t(
              "WhatsApp cannot attach your photos automatically — they are saved with reference {reference}, which the message mentions.",
              { reference: done.reference },
            )}
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
        <h2 className="mt-3 font-display text-2xl text-forest">
          <T>Online quotation requests are not available</T>
        </h2>
        <p className="mt-2 text-ink-muted">
          <T>Please call or WhatsApp the store with the items you need.</T>
        </p>
      </div>
    );
  }

  // Errors: none on an untouched form; a field's error appears when it is left (or on Submit),
  // then re-checks as the visitor types and disappears as soon as the value is valid.
  const err = (k: string) => (submitted || touched[k] ? liveErrors[k] : undefined);
  const onBlurField = (e: FocusEvent<HTMLFormElement>) => {
    const el = e.target as unknown as HTMLInputElement;
    if (!el.name || el.type === "checkbox" || el.type === "file") return;
    const row = el.closest("[data-item-row]");
    const key = row
      ? `items.${[...(formRef.current?.querySelectorAll("[data-item-row]") ?? [])].indexOf(row)}.${el.name}`
      : el.name;
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  };
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      onBlur={onBlurField}
      data-quotation-state={submitting ? "submitting" : "form"}
      aria-busy={submitting || undefined}
      className="space-y-8 rounded-[var(--radius-panel)] border border-line/70 bg-white p-5 shadow-[var(--shadow-card)] sm:p-8 lg:p-10"
    >
      <p className="text-sm text-ink-muted">
        <TRich nodes={{ star: <span className="text-logo-red">*</span> }}>
          {"Fields marked {star} are required. No account needed."}
        </TRich>
      </p>

      {/* Contact details */}
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 font-display text-xl font-semibold text-forest">{t("Your details")}</legend>
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
          hint="10 digits, starting with 0."
        >
          {/* Exactly 10 digits: anything that is not a digit (spaces, +, letters, pasted text) is
              removed as it is typed or pasted, then capped at 10 digits (no maxLength: it would cut a
              pasted "071 234 5678" before the spaces are removed). The API checks again. */}
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="0[0-9]{9}"
            value={form.phone}
            onChange={(e) => set("phone", digitsOnly(e.target.value))}
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
            <option value="">{areas === null ? t("Loading areas…") : t("Choose your area")}</option>
            {(areas ?? []).map((a) => (
              <option key={a.id} value={a.name}>
                {pick(a.name, a.translations, "name")}
              </option>
            ))}
            <option value="Other">{t("Other")}</option>
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
        <legend className="mb-4 font-display text-xl font-semibold text-forest">{t("Products you need")}</legend>
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
                <Field
                  id={`${base}-name`}
                  label={t("Product {n}", { n: i + 1 })}
                  required
                  error={err(`items.${i}.productName`)}
                >
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
                    placeholder={t("bag, piece…")}
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
                    <Trash2 aria-hidden="true" className="size-4" /> {t("Remove")}
                    <span className="sr-only"> {t("product {n}", { n: i + 1 })}</span>
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
            className="mt-4 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-forest/25 px-5 py-2 text-center font-semibold text-forest transition-colors hover:border-brass hover:bg-cream min-[400px]:whitespace-nowrap"
          >
            <Plus aria-hidden="true" className="size-4 shrink-0" /> {t("Add another product")}
          </button>
        ) : null}
      </fieldset>

      {/* Delivery */}
      <fieldset>
        <legend className="mb-4 font-display text-xl font-semibold text-forest">{t("Delivery or collection")}</legend>
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
              <span className="font-semibold text-charcoal">{t(label)}</span>
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
        <legend className="mb-4 font-display text-xl font-semibold text-forest">{t("More details")}</legend>
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
        <Field
          id={`${id}-promo`}
          label="Promo code"
          hint="If you have a code from our offers, enter it here. Our staff confirm the offer and final price."
          error={err("promoCode")}
        >
          <input
            id={`${id}-promo`}
            name="promoCode"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            value={form.promoCode ?? ""}
            onChange={(e) => {
              set("promoCode", e.target.value.toUpperCase().replace(/\s/g, ""));
              setPromo(null);
            }}
            onBlur={async () => {
              const code = (form.promoCode ?? "").trim();
              if (!code || !PROMO_CODE.test(code)) return setPromo(null);
              setPromo(await checkPromoCode(code, form.items.map((it) => it.productSlug ?? "").filter(Boolean)));
            }}
            aria-invalid={!!err("promoCode")}
            aria-describedby={[describedBy(`${id}-promo`, true, err("promoCode")), promo ? `${id}-promo-status` : ""]
              .filter(Boolean)
              .join(" ")}
            className={`${control} font-mono tracking-wider uppercase`}
          />
          {promo && !err("promoCode") ? (
            <p
              id={`${id}-promo-status`}
              role="status"
              data-promo-status={promo}
              className={`mt-1.5 text-sm font-semibold ${promo === "valid" ? "text-forest" : "text-brass-ink"}`}
            >
              {t(PROMO_MESSAGE[promo])}
            </p>
          ) : null}
        </Field>
        <div>
          <p id={`${id}-photos-label`} className="mb-1.5 text-sm font-semibold text-charcoal">
            {t("Reference photos")} <span className="font-normal text-ink-muted">({t("optional")})</span>
          </p>
          <p className="mb-3 text-xs text-ink-muted">
            {t(
              "Up to {n} photos (JPEG, PNG or WebP, 5 MB each) — e.g. the item, a label or your site. Only our staff can see them.",
              { n: MAX_PHOTOS },
            )}
          </p>
          {photos.length ? (
            <ul aria-labelledby={`${id}-photos-label`} className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((p, i) => (
                <li key={p.id} className="relative overflow-hidden rounded-xl border border-line/70 bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
                  <img
                    src={p.url}
                    alt={t("Selected photo {n}", { n: i + 1 })}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="absolute top-1.5 right-1.5 inline-flex size-9 items-center justify-center rounded-full bg-white/95 text-logo-red shadow"
                  >
                    <X aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t("Remove photo {n}", { n: i + 1 })}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {photos.length < MAX_PHOTOS ? (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-dashed border-brass/60 bg-cream/60 px-5 font-semibold text-forest focus-within:shadow-[0_0_0_3px_rgb(15_93_58/0.2)] hover:border-brass">
              <ImagePlus aria-hidden="true" className="size-5 text-brass-ink" />
              {photos.length ? t("Add more photos") : t("Add photos")}
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
              {photoError ?? t(err("photos")!)}
            </p>
          ) : null}
        </div>
      </fieldset>

      {/* Consent + submit */}
      <div className="space-y-5 border-t border-line/70 pt-6">
        {/* Anti-spam honeypot: hidden from people and assistive technology; bots that fill it are refused. */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>
        </div>
        {/* Mandatory consent: unchecked by default, never auto-checked; Submit stays disabled until ticked. */}
        <div data-quotation-consent>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-cream/40 p-3 has-[:checked]:border-forest has-[:checked]:bg-forest-50">
            <input
              type="checkbox"
              name="contactConsent"
              checked={form.contactConsent}
              onChange={(e) => set("contactConsent", e.target.checked)}
              aria-invalid={!!err("contactConsent")}
              aria-describedby={err("contactConsent") ? `${id}-consent-error` : undefined}
              required
              className="mt-0.5 size-6 shrink-0 accent-forest"
            />
            <span className="text-charcoal">
              {t(
                "I agree that Pathirana Hardware may use my submitted contact details, delivery information and photos to process and respond to my quotation request.",
              )}
              <span aria-hidden="true" className="text-logo-red">
                {" "}
                *
              </span>
            </span>
          </label>
          {err("contactConsent") ? (
            <p id={`${id}-consent-error`} className="mt-1.5 text-sm font-semibold text-logo-red">
              {t(err("contactConsent")!)}
            </p>
          ) : null}
        </div>
        {serverError ? (
          <p role="alert" className="rounded-xl border border-logo-red/30 bg-white p-4 font-semibold text-logo-red">
            {serverError}
          </p>
        ) : null}
        {submitted && Object.keys(liveErrors).some((k) => k !== "photos" && liveErrors[k]) ? (
          <p role="alert" className="text-sm font-semibold text-logo-red">
            {t("Please check the highlighted fields.")}
          </p>
        ) : null}
        {!form.contactConsent ? (
          <p data-consent-required className="text-sm font-semibold text-brass-ink">
            {t("Tick the agreement box above to submit your request.")}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !form.contactConsent}
          aria-disabled={submitting || !form.contactConsent}
          className="quote-submit inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest px-5 text-[clamp(0.85rem,3.9vw,1rem)] font-semibold whitespace-nowrap text-white transition-colors hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
        >
          <Send aria-hidden="true" className="size-4" />
          {submitting ? t("Saving your request…") : t("Submit Quotation Request")}
        </button>
        <p data-quotation-not-order className="text-sm text-ink-muted">
          {t(
            "Your request is saved with a reference number, and our team will contact you to confirm prices, availability and delivery.",
          )}{" "}
          {t(QUOTATION_NOT_AN_ORDER)}
        </p>
      </div>
    </form>
  );
}
