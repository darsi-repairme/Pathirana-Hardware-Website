"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Award,
  BarChart3,
  Boxes,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  History,
  Info,
  Layers,
  MessageSquareQuote,
  PackageOpen,
  Tag,
  Truck,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime, type Dashboard } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { auditLabel } from "@/lib/auditLabels";
import { Alert, Spinner } from "@/components/ui";
import { useStaff } from "@/components/AdminShell";

type Kpi = { label: string; value: number; icon: LucideIcon; href: string };

/**
 * Dashboard (admins and editors): welcome banner, live catalogue / quotation / feedback counts from
 * the API, an empty-catalogue hint only when there really are no products, Quick Actions, and —
 * for admins only — Recent Activity from the audit log (the API does not send it to editors).
 */
export default function DashboardPage() {
  const staff = useStaff();
  const isAdmin = staff.role === "admin";
  const res = useApi<Dashboard>("admin/dashboard");
  const data = res.data ?? null;

  const kpis: Kpi[] = data
    ? [
        {
          label: "New Quotation Requests",
          value: data.counts.newQuotations ?? 0,
          icon: ClipboardList,
          href: "/quotations?status=new",
        },
        {
          label: "Feedback Awaiting Review",
          value: data.counts.pendingFeedback ?? 0,
          icon: MessageSquareQuote,
          href: "/feedback?status=pending",
        },
        {
          label: "Published Products",
          value: data.counts.publishedProducts,
          icon: CircleCheck,
          href: "/products?status=published",
        },
        { label: "Categories", value: data.counts.categories, icon: Tag, href: "/categories" },
        { label: "Brands", value: data.counts.brands, icon: Award, href: "/brands" },
        {
          label: "Active Delivery Areas",
          value: data.counts.activeDeliveryAreas,
          icon: Truck,
          href: "/delivery-areas",
        },
      ]
    : [];

  const actions: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Add Product", href: "/products/new", icon: Boxes },
    { label: "Add Category", href: "/categories?new=1", icon: Layers },
    { label: "Add Brand", href: "/brands?new=1", icon: Tag },
    { label: "Manage Delivery Areas", href: "/delivery-areas", icon: Truck },
  ];

  return (
    <div className="space-y-5 sm:space-y-6" data-dashboard={staff.role}>
      <h1 className="sr-only">Dashboard</h1>

      {/* Welcome banner */}
      <section
        aria-labelledby="welcome-title"
        className="relative isolate overflow-hidden rounded-[1.5rem] bg-forest-900 text-white shadow-[var(--shadow-card)]"
      >
        <div className="absolute inset-y-0 right-0 -z-10 w-full sm:w-[64%] lg:w-[58%]">
          <Image
            src="/brand/dashboard-banner.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 50vw, (min-width: 640px) 64vw, 100vw"
            className="[mask-image:linear-gradient(to_right,transparent,#000_30%)] object-cover object-[70%_center] opacity-40 sm:opacity-100"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,var(--color-forest-900)_0%,var(--color-forest)_38%,rgb(15_93_58/0.55)_58%,transparent_78%)]"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          className="absolute right-0 bottom-0 -z-10 h-16 w-2/3 text-gold-soft/80 sm:h-20"
        >
          <path d="M0 120C120 70 250 55 400 20" fill="none" stroke="currentColor" strokeWidth="3" />
          <path
            d="M60 120C170 85 290 75 400 50"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
        </svg>
        <div className="max-w-xl px-5 py-7 sm:px-8 sm:py-9 lg:py-10">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.26em] text-gold-soft uppercase">
            <span aria-hidden="true" className="h-8 w-0.5 rounded-full bg-gold-soft" />
            Welcome back
          </p>
          <h2
            id="welcome-title"
            className="mt-2 font-display text-[clamp(1.6rem,4.5vw,2.25rem)] leading-tight font-semibold"
          >
            Pathirana Hardware Admin
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85 sm:text-[0.95rem]">
            {isAdmin
              ? "Manage your product catalogue, quotations, feedback, staff and deliveries all in one place."
              : "Manage your product catalogue, quotations, feedback and deliveries all in one place."}
          </p>
        </div>
      </section>

      {res.error ? <Alert onRetry={res.reload}>{res.error}</Alert> : null}
      {!data && !res.error ? <Spinner label="Loading the latest figures…" /> : null}

      {data ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
            {/* Catalogue overview */}
            <Link
              href="/products"
              data-kpi="Total Products"
              className="relative isolate flex min-h-44 flex-col overflow-hidden rounded-[1.25rem] bg-[linear-gradient(140deg,var(--color-forest)_0%,var(--color-forest-900)_100%)] p-5 text-white shadow-[var(--shadow-card)] sm:p-6"
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white/10 text-gold-soft ring-1 ring-gold-soft/40">
                  <BarChart3 aria-hidden="true" className="size-5" />
                </span>
                <span className="font-display text-lg font-semibold">Catalogue Overview</span>
              </span>
              <span className="mt-auto pt-6 font-display text-6xl leading-none font-semibold tabular-nums">
                {data.counts.products}
              </span>
              <span className="mt-2 text-sm text-white/85">Total Products</span>
              <span aria-hidden="true" className="absolute right-5 bottom-5 -z-10 flex items-end gap-1.5 opacity-35">
                {[22, 34, 28, 46, 58].map((h) => (
                  <span key={h} className="w-3 rounded-t bg-gold-soft" style={{ height: h }} />
                ))}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 300 60"
                preserveAspectRatio="none"
                className="absolute inset-x-0 bottom-0 -z-10 h-10 w-full text-gold-soft/60"
              >
                <path d="M0 60C90 30 190 25 300 0V60Z" fill="currentColor" fillOpacity="0.25" />
              </svg>
            </Link>

            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {kpis.map(({ label, value, icon: Icon, href }) => (
                <li key={label} className="min-w-0">
                  <Link
                    href={href}
                    data-kpi={label}
                    className="group flex h-full min-h-28 items-center gap-3 rounded-[1.25rem] border border-line/70 bg-paper p-4 shadow-[var(--shadow-card)] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brass/50"
                  >
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-forest-50 text-brass ring-1 ring-line/70">
                      <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.75rem] leading-none font-semibold text-forest tabular-nums">
                        {value}
                      </span>
                      <span className="mt-1 block text-[0.82rem] leading-snug text-ink-muted">{label}</span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="hidden size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 sm:block"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {data.counts.products === 0 ? (
            <div
              role="status"
              data-empty-catalogue
              className="flex items-start gap-3 rounded-[1.25rem] border border-brass/40 bg-[linear-gradient(90deg,#fbf3dd,#f8f1e0)] px-4 py-4 text-sm text-charcoal sm:items-center sm:px-5"
            >
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brass-ink sm:mt-0" />
              <p className="min-w-0 flex-1">
                <strong className="font-semibold">The catalogue is empty.</strong> Start by adding the confirmed
                categories, then add products and publish them when they are ready.
              </p>
              <PackageOpen aria-hidden="true" className="hidden size-8 shrink-0 text-brass sm:block" />
            </div>
          ) : null}

          <div className={`grid gap-4 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
            {isAdmin ? (
              <section
                aria-labelledby="activity-title"
                data-recent-activity
                className="min-w-0 rounded-[1.25rem] border border-line/70 bg-paper shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <h2
                    id="activity-title"
                    className="flex items-center gap-2 font-display text-lg font-semibold text-forest"
                  >
                    <History aria-hidden="true" className="size-5 text-brass" /> Recent Activity
                  </h2>
                  <Link
                    href="/audit-log"
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brass/40 bg-cream px-3 text-xs font-semibold text-brass-ink hover:border-brass"
                  >
                    View All <ChevronRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
                {data.activity?.length ? (
                  <ol className="divide-y divide-line/60 border-t border-line/70">
                    {data.activity.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest">
                          <UserRound aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                          <span className="font-semibold text-charcoal">{a.staffName ?? "System"}</span>{" "}
                          <span className="text-ink-muted">{auditLabel(a.action)}</span>
                        </span>
                        <time dateTime={a.createdAt} className="shrink-0 text-xs whitespace-nowrap text-ink-muted">
                          {formatDateTime(a.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="border-t border-line/70 px-5 py-6 text-sm text-ink-muted">
                    No activity yet. Changes made by staff will appear here.
                  </p>
                )}
              </section>
            ) : null}

            <section
              aria-labelledby="actions-title"
              className="min-w-0 rounded-[1.25rem] border border-line/70 bg-paper p-5 shadow-[var(--shadow-card)]"
            >
              <h2 id="actions-title" className="flex items-center gap-2 font-display text-lg font-semibold text-forest">
                <Zap aria-hidden="true" className="size-5 text-brass" /> Quick Actions
              </h2>
              <ul
                className={`mt-4 grid grid-cols-2 gap-3 ${isAdmin ? "sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-4"}`}
              >
                {actions.map(({ label, href, icon: Icon }) => (
                  <li key={label} className="min-w-0">
                    <Link
                      href={href}
                      data-quick-action={label}
                      className="flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line/70 bg-cream/60 px-2 py-4 text-center text-sm font-semibold text-charcoal transition-colors hover:border-brass hover:bg-cream"
                    >
                      <Icon aria-hidden="true" strokeWidth={1.75} className="size-6 text-forest" />
                      <span className="leading-snug">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
