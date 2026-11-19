"use client";

import { useState } from "react";
import { Mail, MapPin, MessageCircle, Phone, Store, Truck } from "lucide-react";
import {
  api,
  quotationPhotoUrl,
  QUOTATION_STATUS_LABEL,
  QUOTATION_STATUSES,
  type QuotationDetail,
  type QuotationStatus,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Badge, Button, Card, Select, Spinner } from "@/components/ui";
import { formatDateTime, STATUS_TONE } from "../QuotationList";

/** wa.me link to the CUSTOMER (staff start the chat themselves; nothing is sent automatically). */
function customerWhatsapp(q: QuotationDetail) {
  const digits = q.phone.replace(/\D/g, "");
  const text = `Hello ${q.customerName}, this is Pathirana Hardware about your quotation request ${q.reference}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const qty = (v: string) => v.replace(/\.?0+$/, "");

export function QuotationDetailView({ id }: { id: string }) {
  const res = useApi<QuotationDetail>(`admin/quotations/${id}`);
  const [status, setStatus] = useState<QuotationStatus | "">("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = res.data ?? null;

  if (res.error) return <Alert onRetry={res.reload}>{res.error}</Alert>;
  if (!q) return <Spinner />;

  const current = status || q.status;
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
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={customerWhatsapp(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#177a42] px-4 text-sm font-semibold text-white hover:bg-[#11653a]"
            >
              <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp customer
            </a>
            <a
              href={`tel:${q.phone}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-forest/25 px-4 text-sm font-semibold text-forest hover:bg-cream"
            >
              <Phone aria-hidden="true" className="size-4" /> Call
            </a>
            {q.email ? (
              <a
                href={`mailto:${q.email}?subject=${encodeURIComponent(`Quotation ${q.reference}`)}`}
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
                <a
                  href={quotationPhotoUrl(q.id, p.id, "full")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-line/70 bg-cream hover:border-brass"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- staff-only image via the admin gateway */}
                  <img
                    src={quotationPhotoUrl(q.id, p.id)}
                    alt={`Customer reference photo ${p.position}`}
                    width={p.width}
                    height={p.height}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <span className="sr-only"> (open full size)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No photos were attached.</p>
        )}
        <p className="mt-3 text-xs text-ink-muted">Photos are private: only signed-in staff can open them.</p>
      </Card>
    </div>
  );
}
