"use client";

import { useState } from "react";
import { History, RotateCcw, UserRound } from "lucide-react";
import { formatDateTime, qs, type AuditEntry, type StaffMember } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { actionArea, actionOption, AUDIT_ACTIONS, auditLabel, ENTITY_LABEL } from "@/lib/auditLabels";
import { Alert, Button, EmptyState, Input, PageHeader, Pagination, Select, Spinner } from "@/components/ui";

const LIMIT = 25;

const area = (a: AuditEntry) => ENTITY_LABEL[a.entityType] ?? a.entityType;
/** Short form of the affected record's id (the full id is in the title / screen-reader text). */
const shortId = (id?: string | null) => (id ? id.slice(0, 8) : null);

/**
 * Read-only audit history (newest first). Entries are never edited or deleted.
 * Wide screens: a table (When · Staff · Action · Area · Record). Phones and small tablets: one card
 * per event with the same information, so nothing is hidden and the page never scrolls sideways.
 */
type Filters = { entityType: string; staffId: string; action: string; from: string; to: string };
const NO_FILTERS: Filters = { entityType: "", staffId: "", action: "", from: "", to: "" };
const label = "mb-1.5 block text-sm font-semibold text-charcoal";

export function AuditLogView() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const { entityType, staffId, action, from, to } = filters;
  const rangeError = from && to && from > to ? "The start date must be on or before the end date." : null;
  // Every filter change starts again at page 1.
  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const staff = useApi<StaffMember[]>("admin/staff");
  const res = useApi<{ items: AuditEntry[]; total: number; page: number; limit: number }>(
    // A reversed range is not sent: the message below explains it instead.
    rangeError ? null : `admin/audit-log${qs({ entityType, staffId, action, from, to, page, limit: LIMIT })}`,
  );
  const data = rangeError ? null : res.data;
  const actions = AUDIT_ACTIONS.filter((a) => !entityType || actionArea(a) === entityType);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every change staff make is recorded here. Read-only: entries cannot be edited or deleted."
      />
      <div className="mb-4 space-y-3" data-audit-filters>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="min-w-0">
            <label htmlFor="audit-staff" className={label}>
              Person
            </label>
            <Select id="audit-staff" value={staffId} onChange={(e) => update({ staffId: e.target.value })}>
              <option value="">All people</option>
              {(staff.data ?? []).map((s) => (
                // Name + email: two staff may share a name; the filter itself uses the id.
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.email}){s.isActive ? "" : " — inactive"}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label htmlFor="audit-entity" className={label}>
              Area
            </label>
            <Select
              id="audit-entity"
              value={entityType}
              onChange={(e) => {
                const next = e.target.value;
                // Keep the chosen action only if it belongs to the new area.
                update({ entityType: next, action: action && next && actionArea(action) !== next ? "" : action });
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
          <div className="min-w-0">
            <label htmlFor="audit-action" className={label}>
              Action
            </label>
            <Select id="audit-action" value={action} onChange={(e) => update({ action: e.target.value })}>
              <option value="">All actions</option>
              {Object.entries(ENTITY_LABEL)
                .filter(([k]) => actions.some((a) => actionArea(a) === k))
                .map(([k, v]) => (
                  <optgroup key={k} label={v}>
                    {actions
                      .filter((a) => actionArea(a) === k)
                      .map((a) => (
                        <option key={a} value={a}>
                          {actionOption(a)}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </Select>
          </div>
          <div className="min-w-0">
            <label htmlFor="audit-from" className={label}>
              From
            </label>
            <Input
              id="audit-from"
              type="date"
              value={from}
              max={to || undefined}
              aria-invalid={rangeError ? true : undefined}
              aria-describedby={rangeError ? "audit-range-error" : undefined}
              onChange={(e) => update({ from: e.target.value })}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="audit-to" className={label}>
              To
            </label>
            <Input
              id="audit-to"
              type="date"
              value={to}
              min={from || undefined}
              aria-invalid={rangeError ? true : undefined}
              aria-describedby={rangeError ? "audit-range-error" : undefined}
              onChange={(e) => update({ to: e.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {data ? (
            <p className="text-sm text-ink-muted" aria-live="polite">
              {data.total} {data.total === 1 ? "entry" : "entries"}
              {filtered ? " match these filters" : ""} · dates in Sri Lanka time
            </p>
          ) : (
            <span />
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered}
            onClick={() => update(NO_FILTERS)}
            icon={<RotateCcw aria-hidden="true" className="size-4" />}
          >
            Clear filters
          </Button>
        </div>
        {rangeError ? (
          <p id="audit-range-error" role="alert" className="text-sm font-semibold text-logo-red">
            {rangeError}
          </p>
        ) : null}
      </div>
      {rangeError ? null : res.error ? (
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
