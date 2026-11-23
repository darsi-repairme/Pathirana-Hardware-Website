import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { currentStaffOrNull as currentStaff } from "@/lib/server/backend";
import { AuditLogView } from "./AuditLogView";

export const metadata: Metadata = { title: "Audit Log" };

/** Admins only (checked here on the server, and again by the API: editors get 403). */
export default async function AuditLogPage() {
  const me = await currentStaff();
  if (me?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line/70 bg-paper p-8 text-center shadow-[var(--shadow-card)]">
        <ShieldAlert aria-hidden="true" className="mx-auto size-8 text-brass" />
        <h1 className="mt-3 font-display text-2xl font-semibold text-forest">Administrators only</h1>
        <p className="mt-2 text-sm text-ink-muted">The audit log can only be viewed by an administrator.</p>
      </div>
    );
  }
  return <AuditLogView />;
}
