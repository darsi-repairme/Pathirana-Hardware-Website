import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentStaff } from "@/lib/server/backend";
import { AdminShell } from "@/components/AdminShell";

/** Every admin page: the session is validated with the API on each request. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (!staff) {
    const path = (await headers()).get("x-ph-path") ?? "";
    redirect(`/api/session/expired${path ? `?next=${encodeURIComponent(path)}` : ""}`);
  }
  return <AdminShell staff={staff}>{children}</AdminShell>;
}
