"use client";

import { Award, Boxes, ClipboardList, CircleCheck, History, Plus, Tags, Truck } from "lucide-react";
import { formatDate, type Dashboard } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Alert, ButtonLink, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useStaff } from "@/components/AdminShell";

/** Plain-English labels for audit-log actions. */
const ACTIONS: Record<string, string> = {
  "category.create": "added a category",
  "category.update": "edited a category",
  "category.activate": "activated a category",
  "category.deactivate": "deactivated a category",
  "brand.create": "added a brand",
  "brand.update": "edited a brand",
  "brand.activate": "activated a brand",
  "brand.deactivate": "deactivated a brand",
  "product.create": "added a product",
  "product.update": "edited a product",
  "product.publish": "published a product",
  "product.unpublish": "unpublished a product",
  "product.image.add": "added a product image",
  "product.image.remove": "removed a product image",
  "delivery-area.create": "added a delivery area",
  "delivery-area.update": "edited a delivery area",
  "delivery-area.activate": "activated a delivery area",
  "delivery-area.deactivate": "deactivated a delivery area",
  "delivery-area.archive": "archived a delivery area",
  "staff.create": "created a staff account",
  "staff.create-initial-admin": "created the first administrator",
  "staff.activate": "activated a staff account",
  "staff.deactivate": "deactivated a staff account",
  "staff.role": "changed a staff role",
  "staff.password-reset": "reset a staff password",
  "auth.logout": "signed out",
  "auth.locked": "— account locked after failed sign-ins",
  "auth.password-change": "changed their password",
  "catalogue.seed": "loaded the confirmed catalogue structure",
};

export default function DashboardPage() {
  const staff = useStaff();
  const list = useApi<Dashboard>("admin/dashboard");
  const data = list.data ?? null;

  const load = list.reload;

  const cards = data
    ? [
        ...(typeof data.counts.newQuotations === "number"
          ? [
              {
                label: "New Quotation Requests",
                value: data.counts.newQuotations,
                icon: ClipboardList,
                href: "/quotations?status=new",
              },
            ]
          : []),
        { label: "Total Products", value: data.counts.products, icon: Boxes, href: "/products" },
        {
          label: "Published Products",
          value: data.counts.publishedProducts,
          icon: CircleCheck,
          href: "/products?status=published",
        },
        { label: "Categories", value: data.counts.categories, icon: Tags, href: "/categories" },
        { label: "Brands", value: data.counts.brands, icon: Award, href: "/brands" },
        {
          label: "Active Delivery Areas",
          value: data.counts.activeDeliveryAreas,
          icon: Truck,
          href: "/delivery-areas",
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title={`Welcome, ${staff.fullName.split(" ")[0]}`}
        description="An overview of the website catalogue and delivery areas."
        actions={
          <>
            <ButtonLink href="/products/new" icon={<Plus aria-hidden="true" className="size-4" />}>
              Add Product
            </ButtonLink>
            <ButtonLink
              href="/delivery-areas?new=1"
              variant="gold"
              icon={<Truck aria-hidden="true" className="size-4" />}
            >
              Add Delivery Area
            </ButtonLink>
          </>
        }
      />

      {list.error ? <Alert onRetry={load}>{list.error}</Alert> : null}
      {!data && !list.error ? <Spinner /> : null}

      {data ? (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {cards.map(({ label, value, icon: Icon, href }) => (
              <li key={label} className="min-w-0 last:max-lg:col-span-2">
                <a
                  href={href}
                  className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line/70 bg-paper p-4 shadow-[var(--shadow-card)] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brass/50 sm:p-5"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-forest-50 text-brass">
                    <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                  </span>
                  <span className="mt-3 font-display text-3xl font-semibold text-forest [font-variant-numeric:lining-nums_tabular-nums] sm:mt-4">
                    {value}
                  </span>
                  <span className="mt-1 text-sm text-ink-muted">{label}</span>
                </a>
              </li>
            ))}
          </ul>

          {data.counts.products === 0 && data.counts.categories === 0 ? (
            <div className="mt-4">
              <Alert tone="info">
                The catalogue is empty. Start by adding the confirmed categories, then add products and publish them
                when they are ready.
              </Alert>
            </div>
          ) : null}

          <Card className="mt-6">
            <div className="flex items-center gap-2 border-b border-line/70 px-5 py-4">
              <History aria-hidden="true" className="size-4 text-brass" />
              <h2 className="font-display text-lg font-semibold text-forest">Recent activity</h2>
            </div>
            {data.activity.length ? (
              <ol className="divide-y divide-line/60">
                {data.activity.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold text-charcoal">{a.staffName ?? "System"}</span>{" "}
                      <span className="text-ink-muted">{ACTIONS[a.action] ?? a.action}</span>
                    </span>
                    <time dateTime={a.createdAt} className="text-xs whitespace-nowrap text-ink-muted">
                      {formatDate(a.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={<History />} title="No activity yet">
                Changes made by staff will appear here.
              </EmptyState>
            )}
          </Card>
        </>
      ) : null}
    </>
  );
}
