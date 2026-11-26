"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList, ImageIcon, Truck, Store, Eye } from "lucide-react";
import { qs, QUOTATION_STATUS_LABEL, QUOTATION_STATUSES, type QuotationPage, type QuotationStatus } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, Badge, Card, EmptyState, PageHeader, Pagination, SearchBox, Select, Spinner } from "@/components/ui";

const LIMIT = 20;

export const STATUS_TONE: Record<QuotationStatus, "green" | "gold" | "grey" | "red"> = {
  new: "gold",
  in_review: "green",
  quoted: "green",
  closed: "grey",
  cancelled: "red",
};

import { formatDateTime } from "@/lib/api";
export { formatDateTime };

export function QuotationList({ initialStatus }: { initialStatus: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const list = useApi<QuotationPage>(`admin/quotations${qs({ q: debounced, status, page, limit: LIMIT })}`);
  const data = list.data ?? null;
  const filtered = Boolean(debounced || status);

  return (
    <>
      <PageHeader
        title="Quotation Requests"
        description="Requests customers sent from the website. Contact them, then update the status. These are not orders — no payments are taken online."
      />
      {list.error ? (
        <div className="mb-4">
          <Alert onRetry={list.reload}>{list.error}</Alert>
        </div>
      ) : null}
      <Card>
        <div className="grid gap-3 border-b border-line/70 p-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <SearchBox value={q} onChange={setQ} label="Search quotation requests" />
          <div>
            <label htmlFor="f-qstatus" className="sr-only">
              Status
            </label>
            <Select
              id="f-qstatus"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {QUOTATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {QUOTATION_STATUS_LABEL[s]}
                  {data ? ` (${data.statusCounts[s]})` : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="border-b border-line/70 px-4 py-2 text-xs text-ink-muted">
          Search by reference, customer name, phone number, location or product.
        </p>

        {!data && !list.error ? <Spinner /> : null}
        {data && data.items.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title={filtered ? "No matching requests" : "No quotation requests yet"}>
            {filtered
              ? "Try a different search or status."
              : "Requests sent from the website's Request a Quotation form appear here."}
          </EmptyState>
        ) : null}

        {data && data.items.length ? (
          <ul className="divide-y divide-line/60">
            {data.items.map((r) => (
              <li
                key={r.id}
                data-quotation={r.reference}
                className="flex flex-col gap-2 px-4 py-3 hover:bg-cream/40 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/quotations/${r.id}`}
                    className="font-mono text-sm font-semibold tracking-wide text-forest hover:text-brass-ink"
                  >
                    {r.reference}
                  </Link>
                  {r.status === "new" ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-logo-red px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-white uppercase">
                      New
                    </span>
                  ) : null}
                  <p className="truncate font-semibold text-charcoal">{r.customerName}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {r.phone} · {r.location} · {formatDateTime(r.createdAt)}
                  </p>
                </div>
                {/* Fixed-width columns on wide screens so details and status line up from row to row. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted md:w-48 md:shrink-0">
                  <span className="inline-flex items-center gap-1">
                    {r.fulfilment === "delivery" ? (
                      <Truck aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Store aria-hidden="true" className="size-3.5" />
                    )}
                    {r.fulfilment === "delivery" ? "Delivery" : "Collection"}
                  </span>
                  <span>
                    {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
                  </span>
                  {r.photoCount ? (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon aria-hidden="true" className="size-3.5" /> {r.photoCount}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3 md:w-64 md:shrink-0">
                  <span className="md:w-28">
                    <Badge tone={STATUS_TONE[r.status]}>{QUOTATION_STATUS_LABEL[r.status]}</Badge>
                  </span>
                  <Link
                    href={`/quotations/${r.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-3.5 text-[0.8125rem] font-semibold whitespace-nowrap text-white hover:bg-forest-800"
                  >
                    <Eye aria-hidden="true" className="size-4" /> View Details
                    <span className="sr-only"> of {r.reference}</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {data && data.total > LIMIT ? (
          <div className="border-t border-line/70 p-4">
            <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} />
          </div>
        ) : null}
      </Card>
    </>
  );
}
