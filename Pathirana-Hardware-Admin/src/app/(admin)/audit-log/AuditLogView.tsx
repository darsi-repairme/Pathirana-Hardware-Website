"use client";

import { useState } from "react";
import { History, UserRound } from "lucide-react";
import { formatDateTime, qs, type AuditEntry } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { auditLabel, ENTITY_LABEL } from "@/lib/auditLabels";
import { Alert, EmptyState, PageHeader, Pagination, Select, Spinner } from "@/components/ui";

const LIMIT = 25;

/** Read-only audit history (newest first). Entries are never edited or deleted. */
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
      <div className="mb-4 max-w-xs">
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
      {res.error ? (
        <Alert onRetry={res.reload}>{res.error}</Alert>
      ) : !data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<History className="size-6" />} title="No matching activity." />
      ) : (
        <>
          <ol
            data-audit-log
            className="divide-y divide-line/60 overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-paper shadow-[var(--shadow-card)]"
          >
            {data.items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm sm:px-5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest">
                  <UserRound aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <span className="font-semibold text-charcoal">{a.staffName ?? "System"}</span>{" "}
                  <span className="text-ink-muted">{auditLabel(a.action)}</span>
                  <span className="ml-2 inline-block rounded-full bg-cream px-2 py-0.5 text-xs text-brass-ink">
                    {ENTITY_LABEL[a.entityType] ?? a.entityType}
                  </span>
                </span>
                <time dateTime={a.createdAt} className="w-full text-xs whitespace-nowrap text-ink-muted sm:w-auto">
                  {formatDateTime(a.createdAt)}
                </time>
              </li>
            ))}
          </ol>
          <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
