"use client";

import Link from "next/link";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { Mail, Phone, ShoppingCart, Trash2, X } from "lucide-react";
import { business, mailHref, telHref } from "@/content/business";
import { catalogue } from "@/content/products";
import {
  BASKET_STORAGE_KEY,
  enquiryMailto,
  itemCount,
  parseBasket,
  removeItem,
  type BasketItem,
} from "@/lib/enquiry-basket";

const validIds = new Set(catalogue.map((p) => p.id));
const EMPTY: BasketItem[] = [];
let cache: { raw: string | null; items: BasketItem[] } = { raw: null, items: EMPTY };

function read(): BasketItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(BASKET_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) cache = { raw, items: parseBasket(raw, validIds) };
  return cache.items;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === BASKET_STORAGE_KEY && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener("ph-basket", cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("ph-basket", cb);
  };
}

function write(items: BasketItem[]) {
  try {
    window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable — basket simply does not persist */
  }
  window.dispatchEvent(new Event("ph-basket"));
}

/**
 * Header cart icon → product ENQUIRY list (no checkout, payment or ordering).
 * Items can only come from the verified catalogue, which is empty for now, so
 * the panel shows a clear empty state and no count badge is displayed.
 */
export function EnquiryBasket() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const count = itemCount(items);
  const close = useCallback(() => dialogRef.current?.close(), []);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        aria-controls="enquiry-basket"
        className="header-action"
      >
        <ShoppingCart aria-hidden="true" />
        <span className="sr-only">Enquiry list{count > 0 ? `, ${count} items` : ""}</span>
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-white px-1 text-[0.65rem] font-bold text-forest ring-2 ring-forest-900"
          >
            {count}
          </span>
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        id="enquiry-basket"
        aria-labelledby="enquiry-basket-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="ph-dialog ph-drawer fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(24rem,92vw)] max-w-none overflow-y-auto rounded-l-[1.75rem] bg-cream p-0 text-charcoal shadow-2xl"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 id="enquiry-basket-title" className="font-display text-xl text-forest">
              Enquiry list
            </h2>
            <button
              type="button"
              onClick={close}
              autoFocus
              className="inline-flex size-12 items-center justify-center rounded-full hover:bg-forest-50"
            >
              <X aria-hidden="true" className="size-6" />
              <span className="sr-only">Close enquiry list</span>
            </button>
          </div>

          <div className="flex-1 px-5 py-6">
            {items.length === 0 ? (
              <div className="text-center">
                <span className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-brass-100 text-brass-ink">
                  <ShoppingCart aria-hidden="true" className="size-7" />
                </span>
                <p className="mt-4 font-display text-xl text-forest">Your enquiry list is empty</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Online ordering is not available. Our product catalogue is coming soon — until then, call or email us
                  to ask about products and availability.
                </p>
                <Link
                  href="/products/"
                  onClick={close}
                  className="mt-5 inline-flex min-h-11 items-center rounded-full border border-forest/30 px-5 text-sm font-semibold text-forest hover:border-brass"
                >
                  Browse product categories
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      {i.name} <span className="text-ink-muted">× {i.quantity}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => write(removeItem(items, i.id))}
                      className="inline-flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-cream-deep"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      <span className="sr-only">Remove {i.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-line bg-cream-deep px-5 py-5 text-sm">
            {items.length > 0 ? (
              <a
                href={enquiryMailto(business.email, items)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest font-semibold text-white"
              >
                <Mail aria-hidden="true" className="size-4" /> Prepare enquiry email
              </a>
            ) : null}
            <a href={telHref} className="flex min-h-11 items-center gap-3 font-semibold text-forest">
              <Phone aria-hidden="true" className="size-4" /> Call {business.phone.display}
            </a>
            <a href={mailHref} className="flex min-h-11 items-center gap-3 [overflow-wrap:anywhere]">
              <Mail aria-hidden="true" className="size-4 shrink-0" /> {business.email}
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
