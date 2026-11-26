import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { currentStaffOrNull as currentStaff } from "@/lib/server/backend";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

/** Staff sign-in. There is no public registration: accounts are created by an administrator. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string; signedOut?: string; passwordChanged?: string }>;
}) {
  if (await currentStaff()) redirect("/dashboard");
  const sp = await searchParams;
  const next = sp.next && /^\/[a-z0-9/-]*$/i.test(sp.next) && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  const notice = sp.passwordChanged
    ? "Password changed successfully. For your security you are signed out on every device — sign in with your new password."
    : sp.expired
      ? "Your session has ended. Please sign in again."
      : sp.signedOut === "partial"
        ? "You are signed out on this device, but the server could not confirm signing you out on your other devices. Sign in and sign out again when the connection is back."
        : sp.signedOut
          ? "You have signed out."
          : null;

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-forest-900 px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 -z-10 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(232_190_79/0.16),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-1 bg-gradient-to-r from-brass via-gold-soft to-brass"
      />
      <div className="w-full max-w-md">
        <div className="rounded-[1.75rem] border border-gold-soft/25 bg-paper px-6 py-8 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.6)] sm:px-10 sm:py-10">
          <div className="flex flex-col items-center text-center">
            {/* Admin-only clean symbol (no embedded company / Sinhala lettering); the name is the heading. */}
            <Image
              src="/brand/logo-mark.png"
              alt="Pathirana Hardware logo"
              width={420}
              height={345}
              priority
              data-admin-logo
              className="h-[4.5rem] w-auto sm:h-20"
            />
            <h1 className="mt-4 font-display text-2xl font-semibold text-forest">Pathirana Hardware</h1>
            <p className="mt-1 text-xs font-semibold tracking-[0.22em] text-brass-ink uppercase">
              Staff administration
            </p>
            <span aria-hidden="true" className="mt-4 block h-0.5 w-12 bg-brass" />
          </div>
          <LoginForm next={next} notice={notice} />
        </div>
        <p className="mt-6 text-center text-xs text-sage">
          Authorised staff only. Accounts are created by an administrator.
        </p>
      </div>
    </main>
  );
}
