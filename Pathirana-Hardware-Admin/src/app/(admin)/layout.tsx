import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentStaff, SessionCheckUnavailable, type Staff } from "@/lib/server/backend";
import { AdminShell } from "@/components/AdminShell";
import { normaliseWebsiteUrl } from "@/lib/website";

/** Every admin page: the session is validated with the API on each request. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let staff: Staff | null;
  try {
    staff = await currentStaff();
  } catch (e) {
    if (!(e instanceof SessionCheckUnavailable)) throw e;
    // Temporary API problem: keep the session and offer a retry instead of signing out.
    const here = (await headers()).get("x-ph-path");
    const retry = here && here.startsWith("/") && !here.startsWith("//") ? here : "/dashboard";
    return (
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-[1.25rem] border border-line/70 bg-paper p-8 text-center shadow-[0_24px_60px_-40px_rgb(0_0_0/0.5)]"
        >
          <h1 className="font-display text-2xl font-semibold text-forest">Temporarily unavailable</h1>
          <p className="mt-2 text-sm text-ink-muted">
            The server is busy or unreachable. You are still signed in — please try again in a moment.
          </p>
          <a
            href={retry}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-forest px-6 font-semibold text-white"
          >
            Try again
          </a>
        </div>
      </main>
    );
  }
  if (!staff) {
    const path = (await headers()).get("x-ph-path") ?? "";
    redirect(`/api/session/expired${path ? `?next=${encodeURIComponent(path)}` : ""}`);
  }
  return (
    <AdminShell staff={staff} websiteUrl={normaliseWebsiteUrl(process.env.WEBSITE_URL)}>
      {children}
    </AdminShell>
  );
}
