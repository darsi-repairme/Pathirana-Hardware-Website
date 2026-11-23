"use client";

import { useState } from "react";
import { History, UserRound } from "lucide-react";
import { formatDateTime, qs, type AuditEntry } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { auditLabel, ENTITY_LABEL } from "@/lib/auditLabels";
import { Alert, EmptyState, PageHeader, Pagination, Select, Spinner } from "@/components/ui";

const LIMIT = 25;

const area = (a: AuditEntry) => ENTITY_LABEL[a.entityType] ?? a.entityType;
/** Short form of the affected record's id (the full id is in the title / screen-reader text). */
const shortId = (id?: string | null) => (id ? id.slice(0, 8) : null);

/**
 * Read-only audit history (newest first). Entries are never edited or deleted.
 * Wide screens: a table (When · Staff · Action · Area · Record). Phones and small tablets: one card
 * per event with the same information, so nothing is hidden and the page never scrolls sideways.
 */
export function AuditLogView() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const res = useApi<{ items: AuditEntry[]; total: number; page: number; limit: number }>(
    `admin/audit-log${qs({ entityType: entityType || undefined, page, limit: LIMIT })}`,
  );
  const data = res.data;

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every change staff make is recorded here. Read-only: entries cannot be edited or deleted."
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3" data-audit-filters>
        <div className="w-full sm:w-72">
          <label htmlFor="audit-entity" className="mb-1.5 block text-sm font-semibold text-charcoal">
            Show
          </label>
          <Select
            id="audit-entity"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All activity</option>
            {Object.entries(ENTITY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        {data ? (
          <p className="text-sm text-ink-muted" aria-live="polite">
            {data.total} {data.total === 1 ? "entry" : "entries"}
          </p>
        ) : null}
      </div>
      {res.error ? (
        <Alert onRetry={res.reload}>{res.error}</Alert>
      ) : !data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<History className="size-6" />} title="No matching activity." />
      ) : (
        <>
          {/* Table (md and up) */}
          <div
            className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line/70 bg-paper shadow-[var(--shadow-card)] md:block"
            data-audit-table
          >
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">Audit log entries, newest first</caption>
              <colgroup>
                <col className="w-[11rem]" />
                <col className="w-[22%]" />
                <col />
                <col className="w-[9.5rem]" />
                <col className="w-[6.5rem]" />
              </colgroup>
              <thead className="bg-cream/70 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    When
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Staff
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Area
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Record
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60" data-audit-log>
                {data.items.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted tabular-nums">
                      <time dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
                    </td>
                    <td className="px-4 py-3 font-semibold break-words text-charcoal">{a.staffName ?? "System"}</td>
                    <td className="px-4 py-3 break-words text-charcoal">{auditLabel(a.action)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block max-w-full truncate rounded-full bg-cream px-2 py-0.5 text-xs text-brass-ink">
                        {area(a)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted" title={a.entityId ?? undefined}>
                      {shortId(a.entityId) ?? "—"}
                      {a.entityId ? <span className="sr-only">Record id {a.entityId}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (phones and small tablets) */}
          <ol className="space-y-3 md:hidden" data-audit-cards>
            {data.items.map((a) => (
              <li
                key={a.id}
                className="rounded-[var(--radius-card)] border border-line/70 bg-paper px-4 py-3 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest">
                    <UserRound aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="break-words">
                      <span className="font-semibold text-charcoal">{a.staffName ?? "System"}</span>{" "}
                      <span className="text-ink-muted">{auditLabel(a.action)}</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <time dateTime={a.createdAt} className="tabular-nums">
                        {formatDateTime(a.createdAt)}
                      </time>
                      <span className="rounded-full bg-cream px-2 py-0.5 text-brass-ink">{area(a)}</span>
                      {a.entityId ? (
                        <span className="font-mono" title={a.entityId}>
                          #{shortId(a.entityId)}
                          <span className="sr-only">, record id {a.entityId}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
