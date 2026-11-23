"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Boxes, ImageOff, Pencil, Plus } from "lucide-react";
import { api, imageUrl, qs, type Brand, type Category, type Page, type ProductListItem } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { AVAILABILITY_LABEL, AVAILABILITY_TONE, DISCOUNT_STATUS_LABEL, formatLkr, formatPercent } from "@/lib/pricing";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Pagination,
  SearchBox,
  Select,
  Spinner,
  TableWrap,
  td,
  th,
} from "@/components/ui";
import { ViewOnWebsite } from "@/components/ViewOnWebsite";
import { websitePaths } from "@/lib/website";

const LIMIT = 20;
const imageIdFrom = (url: string) => url.split("/").pop()?.split("?")[0] ?? "";

/** "LKR 1,590.00" as two parts: the currency label and the amount (equal-width digits). In the
 *  desktop table the label sits at the left of the price column and the amount at the right, so both
 *  the "LKR" labels and the decimals form straight lines; in phone cards they stay together. */
function Money({ amount, className = "" }: { amount: string; className?: string }) {
  const text = formatLkr(amount);
  return (
    // The space between the parts keeps the text "LKR 1,590.00" for screen readers and copying.
    <span className={`money ${className}`}>
      <span className="money-cur">LKR</span>{" "}
      <span className="money-amt tabular-nums">{text.replace(/^LKR\s*/, "")}</span>
    </span>
  );
}

/** Price as customers see it (calculated by the API), plus the discount state for staff. */
function PriceCell({ p }: { p: ProductListItem }) {
  const { price } = p;
  if (price.contactForPrice) {
    return (
      <span className="price-cell text-sm font-semibold whitespace-nowrap text-ink-muted" data-price="contact">
        Contact for Price
      </span>
    );
  }
  return (
    <span className="price-cell flex flex-col gap-0.5 text-sm leading-tight whitespace-nowrap" data-price="amount">
      {price.discount ? (
        <>
          <Money amount={price.original!} className="text-xs text-ink-muted line-through" />
          <Money amount={price.final!} className="font-semibold text-forest" />
          <span className="price-note text-xs font-semibold text-logo-red">
            {price.discount.type === "percentage"
              ? `${formatPercent(price.discount.value)} off`
              : `${formatLkr(price.discount.amount)} off`}
          </span>
        </>
      ) : (
        <Money amount={price.final!} className="font-semibold text-charcoal" />
      )}
      {p.discountStatus === "scheduled" || p.discountStatus === "expired" || p.discountStatus === "disabled" ? (
        <span className="price-note text-xs text-ink-muted">{DISCOUNT_STATUS_LABEL[p.discountStatus]}</span>
      ) : null}
    </span>
  );
}

function Thumb({ p }: { p: ProductListItem }) {
  return (
    <span className="relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line/70 bg-cream">
      {p.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin image via the admin gateway
        <img
          src={imageUrl(p.id, imageIdFrom(p.image.url))}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <ImageOff aria-hidden="true" className="size-5 text-ink-muted/60" />
      )}
    </span>
  );
}

export function ProductList({
  initialStatus,
  initialNotice = null,
  initialQuery = "",
}: {
  initialStatus: string;
  initialNotice?: string | null;
  /** From the header search (?q=). */
  initialQuery?: string;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [q, setQ] = useState(initialQuery);
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [toggle, setToggle] = useState<ProductListItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    api
      .get<{ items: Category[] }>("admin/categories")
      .then((r) => setCategories(r.items))
      .catch(() => {});
    api
      .get<{ items: Brand[] }>("admin/brands")
      .then((r) => setBrands(r.items))
      .catch(() => {});
  }, []);

  const list = useApi<Page<ProductListItem>>(
    `admin/products${qs({ q: debounced, category, brand, status, page, limit: LIMIT })}`,
  );
  const data = list.data ?? null;
  const load = list.reload;

  const confirmToggle = async () => {
    if (!toggle) return;
    setBusy(true);
    try {
      await api.patch(`admin/products/${toggle.id}/publication`, { published: !toggle.isPublished });
      setNotice(`“${toggle.name}” ${toggle.isPublished ? "unpublished" : "published"}.`);
      setToggle(null);
      load();
    } catch (err) {
      setError((err as Error).message);
      setToggle(null);
    } finally {
      setBusy(false);
    }
  };

  const filtered = Boolean(debounced || category || brand || status);

  return (
    <>
      <PageHeader
        title="Products"
        description="Product types and items shown on the website. New products start as drafts until published."
        actions={
          <ButtonLink href="/products/new" icon={<Plus aria-hidden="true" className="size-4" />}>
            Add Product
          </ButtonLink>
        }
      />
      {notice ? (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error || list.error ? (
        <div className="mb-4">
          <Alert onRetry={load}>{error ?? list.error}</Alert>
        </div>
      ) : null}

      <Card>
        <div className="grid gap-3 border-b border-line/70 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_10rem]">
          <SearchBox value={q} onChange={setQ} label="Search products" />
          <div>
            <label htmlFor="f-category" className="sr-only">
              Category
            </label>
            <Select
              id="f-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="f-brand" className="sr-only">
              Brand
            </label>
            <Select
              id="f-brand"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="f-status" className="sr-only">
              Status
            </label>
            <Select
              id="f-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </Select>
          </div>
        </div>

        {!data && !list.error ? <Spinner /> : null}
        {data && data.items.length === 0 ? (
          <EmptyState icon={<Boxes />} title={filtered ? "No matching products" : "No products yet"}>
            {filtered ? "Try different filters." : "Add a product to start building the online catalogue."}
          </EmptyState>
        ) : null}

        {data && data.items.length ? (
          // One table for every row: fixed column widths on desktop, so prices, availability and status
          // badges and actions form straight columns whatever the amount, label or action set. Below
          // 1280 px the shared responsive table turns each row into a card (labels from the headers).
          <TableWrap>
            <table className="rtable product-rtable w-full table-fixed text-left" data-product-table>
              <colgroup>
                <col />
                <col className="w-[9.5rem]" />
                <col className="w-[8.25rem]" />
                <col className="w-[7rem]" />
                <col className="w-[17rem]" />
              </colgroup>
              <thead className="border-b border-line/70">
                <tr>
                  <th scope="col" className={th}>
                    Product
                  </th>
                  <th scope="col" className={th}>
                    Price
                  </th>
                  <th scope="col" className={th}>
                    Availability
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {data.items.map((p) => (
                  <tr key={p.id} data-product-row className="hover:bg-cream/40">
                    <td className={`${td} rtable-main`}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Thumb p={p} />
                        <div className="min-w-0">
                          <Link
                            href={`/products/${p.id}/edit`}
                            className="line-clamp-2 font-semibold break-words text-charcoal hover:text-forest"
                          >
                            {p.name}
                          </Link>
                          <p className="truncate text-xs text-ink-muted">
                            {p.categoryName}
                            {p.brands.length ? ` · ${p.brands.map((b) => b.name).join(", ")}` : ""}
                            {p.unit ? ` · per ${p.unit}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={td} data-cell="price">
                      <PriceCell p={p} />
                    </td>
                    <td className={td} data-cell="availability">
                      <Badge tone={AVAILABILITY_TONE[p.availability]}>{AVAILABILITY_LABEL[p.availability]}</Badge>
                    </td>
                    <td className={td} data-cell="status">
                      {p.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="gold">Draft</Badge>}
                    </td>
                    <td className={`${td} rtable-actions text-right`}>
                      <div className="row-actions">
                        <Button variant="outline" size="sm" onClick={() => setToggle(p)}>
                          {p.isPublished ? "Unpublish" : "Publish"}
                          <span className="sr-only"> {p.name}</span>
                        </Button>
                        <ButtonLink
                          href={`/products/${p.id}/edit`}
                          variant="outline"
                          size="sm"
                          icon={<Pencil aria-hidden="true" className="size-3.5" />}
                        >
                          Edit<span className="sr-only"> {p.name}</span>
                        </ButtonLink>
                        {p.isPublished ? <ViewOnWebsite path={websitePaths.product(p.slug)} name={p.name} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : null}
        {data ? <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} /> : null}
      </Card>

      <ConfirmDialog
        open={toggle !== null}
        title={toggle?.isPublished ? "Unpublish product?" : "Publish product?"}
        message={
          toggle?.isPublished
            ? `“${toggle.name}” will be hidden from the public website. It stays here as a draft.`
            : `“${toggle?.name}” will appear on the public website (if its category is active).`
        }
        confirmLabel={toggle?.isPublished ? "Unpublish" : "Publish"}
        danger={toggle?.isPublished}
        busy={busy}
        onConfirm={confirmToggle}
        onClose={() => setToggle(null)}
      />
    </>
  );
}
