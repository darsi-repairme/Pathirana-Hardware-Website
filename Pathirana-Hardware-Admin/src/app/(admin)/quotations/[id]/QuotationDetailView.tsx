"use client";

import { useState } from "react";
import { Download, Mail, MapPin, MessageCircle, Phone, Store, Truck } from "lucide-react";
import {
  api,
  PROMO_STATUS_LABEL,
  quotationPhotoUrl,
  QUOTATION_STATUS_LABEL,
  QUOTATION_STATUSES,
  type QuotationDetail,
  type QuotationStatus,
} from "@/lib/api";
import { mailtoHref } from "@/lib/mailto";
import { useApi } from "@/lib/useApi";
import { Alert, AuthImage, Badge, Button, Card, Dialog, Select, Spinner } from "@/components/ui";
import { formatDateTime, STATUS_TONE } from "../QuotationList";

/** Sri Lankan numbers in any stored form (+94…, 94…, 07…) → WhatsApp's international digits. */
function whatsappDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return /^0\d{9}$/.test(d) ? `94${d.slice(1)}` : d;
}

/**
 * "Reply via WhatsApp": opens the CUSTOMER's chat with an editable draft that carries the PHQ
 * reference. Staff replace the placeholder with the confirmed details and press Send themselves —
 * nothing is sent, confirmed or marked as replied automatically.
 */
function customerWhatsapp(q: QuotationDetail) {
  const text = [
    `Hello ${q.customerName},`,
    "",
    `Regarding your quotation request ${q.reference}, we have reviewed your requirements.`,
    "",
    "[Staff enters confirmed quotation details]",
    "",
    "Thank you,",
    "Pathirana Hardware",
  ].join("\n");
  return `https://wa.me/${whatsappDigits(q.phone)}?text=${encodeURIComponent(text)}`;
}

const qty = (v: string) => v.replace(/\.?0+$/, "");

export function QuotationDetailView({ id }: { id: string }) {
  const res = useApi<QuotationDetail>(`admin/quotations/${id}`);
  const [status, setStatus] = useState<QuotationStatus | "">("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<QuotationDetail["photos"][number] | null>(null);
  const q = res.data ?? null;

  if (res.error) return <Alert onRetry={res.reload}>{res.error}</Alert>;
  if (!q) return <Spinner />;

  const current = status || q.status;
  // Customer-supplied address: validated and encoded (null for an unusable address — still shown as text).
  const emailHref = mailtoHref(q.email, { subject: `Quotation ${q.reference}` });
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`admin/quotations/${q.id}/status`, { status: current });
      setNotice(`Status changed to ${QUOTATION_STATUS_LABEL[current]}.`);
      setStatus("");
      res.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-quotation={q.reference}>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-lg font-semibold tracking-wide text-forest">{q.reference}</p>
            <p className="mt-1 text-sm text-ink-muted">Received {formatDateTime(q.createdAt)}</p>
            {q.statusChangedAt ? (
              <p className="text-xs text-ink-muted">
                Status updated {formatDateTime(q.statusChangedAt)}
                {q.statusChangedBy ? ` by ${q.statusChangedBy}` : ""}
              </p>
            ) : null}
          </div>
          <Badge tone={STATUS_TONE[q.status]}>{QUOTATION_STATUS_LABEL[q.status]}</Badge>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line/70 pt-5">
          <div className="w-full max-w-xs">
            <label htmlFor="q-status" className="mb-1.5 block text-sm font-semibold text-charcoal">
              Status
            </label>
            <Select id="q-status" value={current} onChange={(e) => setStatus(e.target.value as QuotationStatus)}>
              {QUOTATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {QUOTATION_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={save} loading={saving} disabled={current === q.status}>
            Save Status
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-forest">Customer</h2>
          <dl className="mt-4 divide-y divide-line/60 text-sm">
            {(
              [
                ["Name", q.customerName],
                ["Phone / WhatsApp", q.phone],
                ["Email", q.email ?? "—"],
                ["Location", `${q.location}${q.locationListed ? "" : " (Other — typed by the customer)"}`],
                ["Delivery or collection", q.fulfilment === "delivery" ? "Delivery" : "Collection from the store"],
                ...(q.fulfilment === "delivery" ? [["Delivery address", q.deliveryAddress ?? "—"]] : []),
                ["Contact consent", q.contactConsent ? "Given" : "Not given"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="font-semibold [overflow-wrap:anywhere] whitespace-pre-line text-charcoal">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 rounded-xl border border-brass/40 bg-cream/60 px-3 py-2 text-sm text-charcoal">
            Check prices, stock and delivery arrangements manually before replying. Nothing is confirmed, ordered or
            reserved automatically — the customer&apos;s request is not an order.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={customerWhatsapp(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#177a42] px-4 text-sm font-semibold text-white hover:bg-[#11653a]"
            >
              <MessageCircle aria-hidden="true" className="size-4" /> Reply via WhatsApp
            </a>
            <a
              href={`tel:${q.phone}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-forest/25 px-4 text-sm font-semibold text-forest hover:bg-cream"
            >
              <Phone aria-hidden="true" className="size-4" /> Call
            </a>
            {emailHref ? (
              <a
                href={emailHref}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-forest/25 px-4 text-sm font-semibold text-forest hover:bg-cream"
              >
                <Mail aria-hidden="true" className="size-4" /> Email
              </a>
            ) : null}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
            {q.fulfilment === "delivery" ? (
              <Truck aria-hidden="true" className="size-5 text-brass" />
            ) : (
              <Store aria-hidden="true" className="size-5 text-brass" />
            )}
            Requested products
          </h2>
          <ol className="mt-4 divide-y divide-line/60">
            {q.items.map((it) => (
              <li key={it.position} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                <span className="min-w-0 font-semibold [overflow-wrap:anywhere] text-charcoal">
                  {it.position}. {it.productName}
                  {it.productId ? (
                    <a
                      href={`/products/${it.productId}/edit`}
                      className="ml-2 text-xs font-normal text-forest underline underline-offset-2"
                    >
                      product
                    </a>
                  ) : null}
                </span>
                <span className="shrink-0 text-charcoal tabular-nums">
                  {qty(it.quantity)} {it.unit ?? ""}
                </span>
              </li>
            ))}
          </ol>
          {q.notes ? (
            <div className="mt-5 border-t border-line/70 pt-4">
              <p className="text-sm font-semibold text-ink-muted">Notes</p>
              <p className="mt-1 text-sm [overflow-wrap:anywhere] whitespace-pre-line text-charcoal">{q.notes}</p>
            </div>
          ) : null}
          {q.promoCode ? (
            <div className="mt-5 border-t border-line/70 pt-4" data-promo={q.promoStatus ?? ""}>
              <p className="text-sm font-semibold text-ink-muted">Promo code quoted by the customer</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-md border border-dashed border-brass bg-cream/70 px-2 py-0.5 font-mono font-semibold text-forest">
                  {q.promoCode}
                </span>
                <Badge tone={q.promoStatus === "valid" ? "green" : q.promoStatus === "not_eligible" ? "gold" : "grey"}>
                  {q.promoStatus ? PROMO_STATUS_LABEL[q.promoStatus] : "Not checked"}
                </Badge>
              </p>
              {q.promoOfferTitle ? (
                <p className="mt-1 text-xs text-ink-muted">
                  Offer: {q.promoOfferTitle}
                  {q.promoOfferBenefit ? ` — ${q.promoOfferBenefit}` : ""}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-ink-muted">
                Recorded when the request was saved. Confirm the offer, final price, stock and delivery yourself before
                replying — nothing was applied automatically.
              </p>
            </div>
          ) : null}
          <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin aria-hidden="true" className="size-3.5" /> {q.location}
          </p>
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-forest">
          Reference photos {q.photos.length ? `(${q.photos.length})` : ""}
        </h2>
        {q.photos.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {q.photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPhoto(p)}
                  data-photo={p.position}
                  className="block w-full overflow-hidden rounded-xl border border-line/70 bg-cream hover:border-brass focus-visible:outline-2 focus-visible:outline-brass"
                >
                  <AuthImage
                    src={quotationPhotoUrl(q.id, p.id)}
                    alt={`Customer reference photo ${p.position}`}
                    className="aspect-square w-full object-cover"
                    fallbackClassName="aspect-square w-full"
                  />
                  <span className="sr-only"> (open a larger preview)</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No photos were attached.</p>
        )}
        <p className="mt-3 text-xs text-ink-muted">Photos are private: only signed-in staff can open them.</p>
      </Card>

      <Dialog
        open={photo !== null}
        title={photo ? `${q.reference} — photo ${photo.position} of ${q.photos.length}` : "Photo"}
        onClose={() => setPhoto(null)}
        footer={
          photo ? (
            <>
              <a
                href={quotationPhotoUrl(q.id, photo.id, "full")}
                download={`${q.reference}-photo-${photo.position}.webp`}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-forest/25 px-5 text-sm font-semibold text-forest hover:bg-cream"
              >
                <Download aria-hidden="true" className="size-4" /> Download
              </a>
              <a
                href={quotationPhotoUrl(q.id, photo.id, "full")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white"
              >
                Open full size
              </a>
            </>
          ) : null
        }
      >
        {photo ? (
          <AuthImage
            key={photo.id}
            src={quotationPhotoUrl(q.id, photo.id, "full")}
            alt={`Customer reference photo ${photo.position}`}
            className="max-h-[70vh] w-full rounded-xl object-contain"
            fallbackClassName="h-48 w-full"
          />
        ) : null}
      </Dialog>
    </div>
  );
}
