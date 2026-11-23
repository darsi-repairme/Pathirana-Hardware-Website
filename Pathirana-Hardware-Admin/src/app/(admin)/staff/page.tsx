import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { currentStaffOrNull as currentStaff } from "@/lib/server/backend";
import { StaffManager } from "./StaffManager";

export const metadata: Metadata = { title: "Staff" };

/** Admins only (checked here on the server, and again by the API on every call). */
export default async function StaffPage() {
  const me = await currentStaff();
  if (me?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md rounded-[var(--radius-card)] border border-line/70 bg-paper p-8 text-center shadow-[var(--shadow-card)]">
        <ShieldAlert aria-hidden="true" className="mx-auto size-8 text-brass" />
        <h1 className="mt-3 font-display text-2xl font-semibold text-forest">Administrators only</h1>
        <p className="mt-2 text-sm text-ink-muted">Staff accounts can only be managed by an administrator.</p>
      </div>
    );
  }
  return <StaffManager />;
}
