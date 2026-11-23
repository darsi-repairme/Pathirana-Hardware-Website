import type { Metadata } from "next";
import Image from "next/image";
import { SetupPasswordForm } from "./SetupPasswordForm";

export const metadata: Metadata = { title: "Set your password", robots: { index: false, follow: false } };

/** Opened from a one-time link an admin passed on privately. No session is needed or created. */
export default async function SetupPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-forest-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-[1.75rem] border border-gold-soft/25 bg-paper px-6 py-8 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)] sm:px-10 sm:py-10">
          <div className="flex flex-col items-center text-center">
            {/* Admin-only clean symbol (no embedded company / Sinhala lettering). */}
            <Image
              src="/brand/logo-mark.png"
              alt="Pathirana Hardware logo"
              width={420}
              height={345}
              priority
              data-admin-logo
              className="h-16 w-auto"
            />
            <p className="mt-3 font-display text-lg font-semibold text-forest">Pathirana Hardware</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-forest">Set your password</h1>
            <span aria-hidden="true" className="mt-4 block h-0.5 w-12 bg-brass" />
          </div>
          <SetupPasswordForm token={token} />
        </div>
        <p className="mt-6 text-center text-xs text-sage">
          This link works once and expires after 24 hours. Never share your password.
        </p>
      </div>
    </main>
  );
}
