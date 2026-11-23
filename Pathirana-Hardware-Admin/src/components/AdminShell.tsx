"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Award,
  Bell,
  Boxes,
  ExternalLink,
  Globe,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Gift,
  History,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Search,
  Settings,
  Tags,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, type Dashboard } from "@/lib/api";
import { AdminBrand } from "@/components/AdminBrand";
import { Avatar } from "@/components/ProfilePhoto";
import { ConfirmDialog } from "@/components/ui";

export type SessionStaff = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "editor";
  /** Profile photo cache key (null = none; older APIs omit it). */
  photoVersion?: string | null;
};

const StaffContext = createContext<SessionStaff | null>(null);
/** The signed-in staff member (validated by the API on page load). */
export function useStaff(): SessionStaff {
  const s = useContext(StaffContext);
  if (!s) throw new Error("useStaff outside AdminShell");
  return s;
}

const PhotoContext = createContext<{ version: string | null; setVersion: (v: string | null) => void }>({
  version: null,
  setVersion: () => {},
});
/** The signed-in staff member's profile photo version (null = no photo) and a setter after changes. */
export function useOwnPhoto() {
  return useContext(PhotoContext);
}

const WebsiteContext = createContext<string | null>(null);
/** The public website's address (WEBSITE_URL), or null when not configured. */
export function useWebsiteUrl(): string | null {
  return useContext(WebsiteContext);
}

type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotations", label: "Quotation Requests", icon: ClipboardList },
  { href: "/feedback", label: "Customer Feedback", icon: MessageSquareQuote },
  { href: "/products", label: "Products", icon: Boxes },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/brands", label: "Brands", icon: Award },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/offers", label: "Offers", icon: Gift },
  { href: "/delivery-areas", label: "Delivery Areas", icon: Truck },
  { href: "/staff", label: "Staff", icon: Users, adminOnly: true },
  { href: "/audit-log", label: "Audit Log", icon: History, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function titleFor(path: string) {
  if (path === "/products/new") return "Add Product";
  if (/^\/products\/[^/]+\/edit/.test(path)) return "Edit Product";
  return NAV.find((n) => path === n.href || path.startsWith(`${n.href}/`))?.label ?? "Admin";
}

/** Closes a popover on outside click / Escape. */
function usePopover(open: boolean, close: () => void, root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, root]);
}

/**
 * Admin layout: deep-green sidebar with the clean Admin brand (fixed on desktop, collapsible; an
 * accessible drawer on phones and tablets) and a top bar with the page title, product search,
 * real notifications (new quotation requests / feedback awaiting review), and the signed-in staff
 * member's menu (Settings, Audit Log for admins, Sign out — always confirmed first).
 */
export function AdminShell({
  staff,
  websiteUrl = null,
  children,
}: {
  staff: SessionStaff;
  websiteUrl?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [counts, setCounts] = useState<Dashboard["counts"] | null>(null);
  const [q, setQ] = useState("");
  const menuRoot = useRef<HTMLDivElement>(null);
  const bellRoot = useRef<HTMLDivElement>(null);
  // Own profile photo version: comes with the session check (no extra request).
  const [photoVersion, setPhotoVersion] = useState<string | null>(staff.photoVersion ?? null);
  const items = NAV.filter((n) => !n.adminOnly || staff.role === "admin");

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ph-admin-collapsed") === "1");
    } catch {}
  }, []);
  useEffect(() => {
    setDrawer(false);
    setMenu(false);
    setBell(false);
  }, [pathname]);
  // Notification counts come from the live dashboard data: refreshed on page changes, but a response
  // under 20 s old is reused (any change made in the Admin clears it), so moving between pages does
  // not repeat the request every time.
  useEffect(() => {
    let active = true;
    api
      .get<Dashboard>("admin/dashboard", { maxAgeMs: 20_000 })
      .then((d) => active && setCounts(d.counts))
      .catch(() => active && setCounts(null));
    return () => {
      active = false;
    };
  }, [pathname]);
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
  usePopover(menu, () => setMenu(false), menuRoot);
  usePopover(bell, () => setBell(false), bellRoot);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ph-admin-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const askSignOut = () => {
    setMenu(false);
    setSignOutError(null);
    setConfirmOut(true);
  };
  /** Runs only after confirmation; one request at a time; the API revokes the session token. */
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      const res = await fetch("/api/session", { method: "DELETE", headers: { "x-ph-admin": "1" } });
      if (!res.ok && res.status !== 401) throw new Error(String(res.status));
      setConfirmOut(false);
      router.replace("/login?signedOut=1");
      router.refresh();
    } catch {
      setSignOutError("Signing out failed. Check your connection and try again.");
      setSigningOut(false);
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  };

  const alerts = counts
    ? [
        ...(counts.newQuotations
          ? [
              {
                href: "/quotations?status=new",
                text: `${counts.newQuotations} new quotation request${counts.newQuotations === 1 ? "" : "s"}`,
              },
            ]
          : []),
        ...(counts.pendingFeedback
          ? [
              {
                href: "/feedback?status=pending",
                text: `${counts.pendingFeedback} feedback item${counts.pendingFeedback === 1 ? "" : "s"} awaiting review`,
              },
            ]
          : []),
      ]
    : [];
  const alertTotal = (counts?.newQuotations ?? 0) + (counts?.pendingFeedback ?? 0);

  const nav = (compact: boolean) => (
    <nav
      aria-label="Admin"
      data-admin-nav
      className="admin-scroll mt-4 min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto py-1 pr-1.5 pl-3"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={compact ? label : undefined}
            className={`group flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-[0.925rem] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-gold-soft/70 ${
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
            <span className={compact ? "sr-only" : "min-w-0 truncate"}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  /** Opens the public website in a new tab (only when WEBSITE_URL is configured). */
  const viewSite = (compact: boolean) =>
    websiteUrl ? (
      <a
        href={`${websiteUrl}/`}
        target="_blank"
        rel="noopener noreferrer"
        title={compact ? "View Website" : undefined}
        data-view-website
        className={`flex min-h-11 items-center gap-3 rounded-xl border border-gold-soft/25 px-3 text-[0.925rem] font-medium text-gold-soft transition-colors outline-none hover:border-gold-soft/60 hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-gold-soft/70 ${
          compact ? "justify-center px-0" : ""
        }`}
      >
        <Globe aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
        <span className={compact ? "sr-only" : "min-w-0 flex-1"}>View Website</span>
        {compact ? null : <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : null;

  const brand = (compact: boolean) => (
    <Link
      href="/dashboard"
      aria-label="Pathirana Hardware — Admin dashboard"
      className={`flex min-w-0 items-center pt-6 ${compact ? "justify-center px-0" : "pr-4 pl-6"}`}
    >
      <AdminBrand tone="light" compact={compact} priority />
    </Link>
  );

  return (
    <StaffContext.Provider value={staff}>
      <PhotoContext.Provider value={{ version: photoVersion, setVersion: setPhotoVersion }}>
        <WebsiteContext.Provider value={websiteUrl}>
          <div className="min-h-dvh lg:flex">
            {/* Desktop sidebar */}
            <aside
              className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-gold-soft/15 bg-forest-900 transition-[width] duration-300 lg:flex ${
                collapsed ? "w-20" : "w-[17.5rem]"
              }`}
            >
              {brand(collapsed)}
              <span
                aria-hidden="true"
                className={`mt-5 block h-px bg-gradient-to-r from-gold-soft/50 to-transparent ${collapsed ? "mx-4" : "mx-6"}`}
              />
              {nav(collapsed)}
              {/* Footer: separated from the scrolling list so it never overlaps the last items. */}
              <div data-sidebar-footer className="shrink-0 space-y-1 border-t border-white/10 p-3">
                {viewSite(collapsed)}
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-pressed={collapsed}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-sm text-sage outline-none hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-gold-soft/70"
                >
                  {collapsed ? (
                    <ChevronsRight aria-hidden="true" className="size-4" />
                  ) : (
                    <ChevronsLeft aria-hidden="true" className="size-4" />
                  )}
                  <span className={collapsed ? "sr-only" : ""}>{collapsed ? "Expand menu" : "Collapse menu"}</span>
                </button>
              </div>
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
                <div className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col overflow-hidden bg-forest-900 shadow-[var(--shadow-lift)]">
                  <div className="flex min-w-0 items-start justify-between">
                    {brand(false)}
                    <button
                      type="button"
                      onClick={() => setDrawer(false)}
                      autoFocus
                      className="m-3 inline-flex size-11 items-center justify-center rounded-full text-sage hover:bg-white/10 hover:text-white"
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
                  <div data-sidebar-footer className="shrink-0 space-y-2 border-t border-white/10 p-3">
                    {viewSite(false)}
                    <button
                      type="button"
                      onClick={askSignOut}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      <LogOut aria-hidden="true" className="size-4" /> Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line/70 bg-paper/95 px-3 backdrop-blur sm:gap-3 sm:px-6 lg:h-[4.5rem]">
                <button
                  type="button"
                  onClick={() => setDrawer(true)}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-forest hover:bg-forest-50 lg:hidden"
                >
                  <Menu aria-hidden="true" className="size-5" />
                  <span className="sr-only">Open menu</span>
                </button>
                <p className="flex min-w-0 flex-1 items-center gap-3 truncate font-display text-lg font-semibold text-forest sm:text-xl">
                  <span aria-hidden="true" className="hidden h-6 w-1 shrink-0 rounded-full bg-brass sm:block" />
                  <span className="truncate">{titleFor(pathname)}</span>
                </p>

                <form role="search" onSubmit={search} className="relative hidden w-[min(22rem,32vw)] md:block">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
                  />
                  <label htmlFor="admin-search" className="sr-only">
                    Search products
                  </label>
                  <input
                    id="admin-search"
                    type="search"
                    value={q}
                    maxLength={80}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search products…"
                    className="h-11 w-full rounded-full border border-line-strong bg-white pr-4 pl-10 text-sm text-charcoal outline-none placeholder:text-ink-muted focus:border-forest focus:shadow-[0_0_0_3px_rgb(15_93_58/0.15)]"
                  />
                </form>
                <Link
                  href="/products"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-forest hover:bg-forest-50 md:hidden"
                >
                  <Search aria-hidden="true" className="size-5" />
                  <span className="sr-only">Search products</span>
                </Link>

                {/* Notifications: only real, live items (new quotation requests, feedback awaiting review). */}
                <div ref={bellRoot} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setBell((b) => !b)}
                    aria-expanded={bell}
                    aria-haspopup="true"
                    data-notifications
                    className="relative inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-white text-forest hover:border-brass"
                  >
                    <Bell aria-hidden="true" className="size-5" />
                    {alertTotal ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-brass px-1 text-[0.6rem] leading-4 font-bold text-white ring-2 ring-white"
                      >
                        {alertTotal > 99 ? "99+" : alertTotal}
                      </span>
                    ) : null}
                    <span className="sr-only">
                      Notifications
                      {alertTotal ? `: ${alertTotal} item${alertTotal === 1 ? "" : "s"} need attention` : ""}
                    </span>
                  </button>
                  {bell ? (
                    <div className="absolute top-full right-0 z-40 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line/70 bg-paper shadow-[var(--shadow-lift)]">
                      <p className="border-b border-line/70 px-4 py-3 text-sm font-semibold text-charcoal">
                        Notifications
                      </p>
                      {alerts.length ? (
                        <ul>
                          {alerts.map((a) => (
                            <li key={a.href}>
                              <Link
                                href={a.href}
                                className="flex min-h-11 items-center px-4 text-sm text-forest hover:bg-cream"
                              >
                                {a.text}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="px-4 py-4 text-sm text-ink-muted">
                          {counts ? "Nothing needs attention right now." : "Notifications are unavailable."}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Account menu: the signed-in person's real name and role. */}
                <div ref={menuRoot} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenu((m) => !m)}
                    aria-expanded={menu}
                    aria-haspopup="menu"
                    data-account-menu
                    className="inline-flex h-11 items-center gap-2 rounded-full pr-2 pl-1 hover:bg-forest-50 sm:pr-3"
                  >
                    <Avatar name={staff.fullName} target={{ self: true }} version={photoVersion} />
                    <span className="hidden min-w-0 text-left lg:block">
                      <span className="block max-w-[11rem] truncate text-sm font-semibold text-charcoal">
                        {staff.fullName}
                      </span>
                      <span className="block text-xs text-brass-ink">
                        {staff.role === "admin" ? "Administrator" : "Editor"}
                      </span>
                    </span>
                    <ChevronDown aria-hidden="true" className="hidden size-4 text-ink-muted sm:block" />
                    <span className="sr-only lg:hidden">
                      Account: {staff.fullName}, {staff.role === "admin" ? "Administrator" : "Editor"}
                    </span>
                  </button>
                  {menu ? (
                    <div
                      role="menu"
                      className="absolute top-full right-0 z-40 mt-2 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line/70 bg-paper shadow-[var(--shadow-lift)]"
                    >
                      <div className="border-b border-line/70 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-charcoal">{staff.fullName}</p>
                        <p className="truncate text-xs text-ink-muted">{staff.email}</p>
                        <p className="mt-1 text-xs font-semibold text-brass-ink">
                          {staff.role === "admin" ? "Administrator" : "Editor"}
                        </p>
                      </div>
                      <Link
                        role="menuitem"
                        href="/settings"
                        className="flex min-h-11 items-center gap-2.5 px-4 text-sm text-charcoal hover:bg-cream"
                      >
                        <Settings aria-hidden="true" className="size-4 text-brass" /> Settings
                      </Link>
                      {staff.role === "admin" ? (
                        <Link
                          role="menuitem"
                          href="/audit-log"
                          className="flex min-h-11 items-center gap-2.5 px-4 text-sm text-charcoal hover:bg-cream"
                        >
                          <History aria-hidden="true" className="size-4 text-brass" /> Audit Log
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={askSignOut}
                        className="flex min-h-11 w-full items-center gap-2.5 border-t border-line/70 px-4 text-left text-sm font-semibold text-logo-red hover:bg-cream"
                      >
                        <LogOut aria-hidden="true" className="size-4" /> Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </header>
              <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {children}
              </main>
            </div>
          </div>

          <ConfirmDialog
            open={confirmOut}
            title="Sign out?"
            message={
              signOutError ? (
                <span role="alert" className="font-semibold text-logo-red">
                  {signOutError}
                </span>
              ) : (
                "Are you sure you want to sign out of your account?"
              )
            }
            confirmLabel="Sign Out"
            danger
            busy={signingOut}
            onConfirm={signOut}
            onClose={() => {
              if (!signingOut) setConfirmOut(false);
            }}
          />
        </WebsiteContext.Provider>
      </PhotoContext.Provider>
    </StaffContext.Provider>
  );
}
