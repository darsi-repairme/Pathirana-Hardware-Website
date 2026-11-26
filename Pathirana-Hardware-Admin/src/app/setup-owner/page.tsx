import type { Metadata } from "next";
import Image from "next/image";
import { SetupOwnerForm } from "./SetupOwnerForm";

export const metadata: Metadata = { title: "Owner set-up", robots: { index: false, follow: false } };

/**
 * One-time Owner (first administrator) registration. Not linked from anywhere: it is used once,
 * on a new installation, with the code printed by `npm run owner:code` on the server. Once an
 * administrator exists the page only says that registration is closed.
 */
export default function SetupOwnerPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-forest-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-[1.75rem] border border-gold-soft/25 bg-paper px-6 py-8 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)] sm:px-10 sm:py-10">
          <div className="flex flex-col items-center text-center">
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
            <h1 className="mt-1 font-display text-2xl font-semibold text-forest">Owner Account Set-up</h1>
            <span aria-hidden="true" className="mt-4 block h-0.5 w-12 bg-brass" />
          </div>
          <SetupOwnerForm />
        </div>
        <p className="mt-6 text-center text-xs text-sage">
          Used once to create the first administrator. Never share your verification code or password.
        </p>
      </div>
    </main>
  );
}
