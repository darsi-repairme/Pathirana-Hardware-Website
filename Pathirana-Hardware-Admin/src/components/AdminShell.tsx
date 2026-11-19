"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Boxes,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Tags,
  Truck,
  Users,
  Award,
  X,
  type LucideIcon,
} from "lucide-react";

export type SessionStaff = { id: string; email: string; fullName: string; role: "admin" | "editor" };

const StaffContext = createContext<SessionStaff | null>(null);
/** The signed-in staff member (validated by the API on page load). */
export function useStaff(): SessionStaff {
  const s = useContext(StaffContext);
  if (!s) throw new Error("useStaff outside AdminShell");
  return s;
}

type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotations", label: "Quotation Requests", icon: ClipboardList },
  { href: "/products", label: "Products", icon: Boxes },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/brands", label: "Brands", icon: Award },
  { href: "/delivery-areas", label: "Delivery Areas", icon: Truck },
  { href: "/staff", label: "Staff", icon: Users, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function titleFor(path: string) {
  if (path === "/products/new") return "Add Product";
  if (/^\/products\/[^/]+\/edit/.test(path)) return "Edit Product";
  return NAV.find((n) => path === n.href || path.startsWith(`${n.href}/`))?.label ?? "Admin";
}

/**
 * Admin layout: deep-green sidebar with the original logo (fixed on desktop,
 * collapsible; an accessible drawer on phones and tablets), and a top bar with
 * the page title, the signed-in staff member and Sign out.
 */
export function AdminShell({ staff, children }: { staff: SessionStaff; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const items = NAV.filter((n) => !n.adminOnly || staff.role === "admin");

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ph-admin-collapsed") === "1");
    } catch {}
  }, []);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ph-admin-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/session", { method: "DELETE", headers: { "x-ph-admin": "1" } });
    } finally {
      router.replace("/login?signedOut=1");
      router.refresh();
    }
  };

  const nav = (compact: boolean) => (
    <nav aria-label="Admin" className="mt-6 flex-1 space-y-1 px-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={compact ? label : undefined}
            className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.925rem] font-medium transition-colors duration-200 ${
              active
                ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-gold-soft)]"
                : "text-sage hover:bg-white/5 hover:text-white"
            } ${compact ? "justify-center px-0" : ""}`}
          >
            <Icon
              aria-hidden="true"
              strokeWidth={1.75}
              className={`size-5 shrink-0 ${active ? "text-gold-soft" : "text-gold-soft/70 group-hover:text-gold-soft"}`}
            />
            <span className={compact ? "sr-only" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (compact: boolean) => (
    <Link href="/dashboard" className={`flex items-center gap-3 px-5 pt-6 ${compact ? "justify-center px-0" : ""}`}>
      {/* The original logo (cream-lettering variant used on the website's dark green). */}
      <Image
        src="/brand/logo-light.png"
        alt="Pathirana Hardware (Pvt) Ltd."
        width={806}
        height={755}
        priority
        className="h-11 w-auto shrink-0"
      />
      {compact ? null : (
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-[1.05rem] font-semibold text-white">Pathirana Hardware</span>
          <span className="block text-[0.65rem] font-semibold tracking-[0.2em] text-gold-soft uppercase">
            Staff Admin
          </span>
        </span>
      )}
    </Link>
  );

  return (
    <StaffContext.Provider value={staff}>
      <div className="min-h-dvh lg:flex">
        {/* Desktop sidebar */}
        <aside
          className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-gold-soft/15 bg-forest-900 transition-[width] duration-300 lg:flex ${
            collapsed ? "w-20" : "w-64"
          }`}
        >
          {brand(collapsed)}
          <span
            aria-hidden="true"
            className={`mx-5 mt-5 block h-px bg-gradient-to-r from-gold-soft/50 to-transparent ${collapsed ? "mx-4" : ""}`}
          />
          {nav(collapsed)}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            className="m-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm text-sage hover:bg-white/5 hover:text-white"
          >
            {collapsed ? (
              <ChevronsRight aria-hidden="true" className="size-4" />
            ) : (
              <ChevronsLeft aria-hidden="true" className="size-4" />
            )}
            <span className={collapsed ? "sr-only" : ""}>{collapsed ? "Expand menu" : "Collapse menu"}</span>
          </button>
        </aside>

        {/* Mobile / tablet drawer */}
        {drawer ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-forest-900/60"
            />
            <div className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col bg-forest-900 shadow-[var(--shadow-lift)]">
              <div className="flex items-start justify-between">
                {brand(false)}
                <button
                  type="button"
                  onClick={() => setDrawer(false)}
                  autoFocus
                  className="m-3 inline-flex size-10 items-center justify-center rounded-full text-sage hover:bg-white/10 hover:text-white"
                >
                  <X aria-hidden="true" className="size-5" />
                  <span className="sr-only">Close menu</span>
                </button>
              </div>
              <span
                aria-hidden="true"
                className="mx-5 mt-5 block h-px bg-gradient-to-r from-gold-soft/50 to-transparent"
              />
              {nav(false)}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/70 bg-paper/95 px-4 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="inline-flex size-10 items-center justify-center rounded-full text-forest hover:bg-forest-50 lg:hidden"
            >
              <Menu aria-hidden="true" className="size-5" />
              <span className="sr-only">Open menu</span>
            </button>
            <p className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-forest">
              {titleFor(pathname)}
            </p>
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-semibold text-charcoal">{staff.fullName}</p>
              <p className="text-xs text-brass-ink capitalize">{staff.role}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-3.5 text-sm font-semibold text-forest hover:border-brass hover:bg-cream disabled:opacity-60"
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="max-[380px]:sr-only">Sign out</span>
            </button>
          </header>
          <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}
