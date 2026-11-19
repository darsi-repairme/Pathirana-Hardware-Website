import type { Availability, DiscountStatus, DiscountType } from "./api";

/**
 * Display helpers and instant form checks for prices. The price itself — the
 * discount amount and the final selling price — is ALWAYS calculated by the
 * API (one authoritative implementation); nothing here computes it.
 */

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Available",
  out_of_stock: "Out of Stock",
  on_request: "On Request",
};
export const AVAILABILITY_TONE: Record<Availability, "green" | "red" | "gold"> = {
  available: "green",
  out_of_stock: "red",
  on_request: "gold",
};
export const DISCOUNT_STATUS_LABEL: Record<DiscountStatus, string> = {
  none: "No discount",
  disabled: "Discount off",
  scheduled: "Discount scheduled",
  expired: "Discount expired",
  active: "Discount active",
};

/** Suggested units (staff can type any other approved unit). */
export const UNIT_SUGGESTIONS = ["bag", "sheet", "piece"];

const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

/** "2250.5" → "LKR 2,250.50" (string formatting only — no arithmetic). */
export function formatLkr(amount: string): string {
  const [whole = "0", frac = ""] = amount.split(".");
  return `LKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac.padEnd(2, "0").slice(0, 2)}`;
}

/** "10.00" → "10%" ; "12.50" → "12.5%". */
export const formatPercent = (v: string) => `${v.replace(/\.?0+$/, "")}%`;

const cents = (s: string) => {
  const [w, f = ""] = s.split(".");
  return BigInt(w!) * 100n + BigInt(f.padEnd(2, "0"));
};

export type PriceForm = {
  priceLkr: string;
  contactForPrice: boolean;
  discountType: DiscountType;
  discountValue: string;
  discountEnabled: boolean;
  discountStartsOn: string;
  discountEndsOn: string;
};

/** Field → message, shown instantly. The API repeats every check (and the database enforces them). */
export function priceFormErrors(f: PriceForm): Partial<Record<keyof PriceForm, string>> {
  const e: Partial<Record<keyof PriceForm, string>> = {};
  const price = f.priceLkr.trim();
  if (price && !MONEY.test(price)) e.priceLkr = "Enter an LKR amount with up to 2 decimals, e.g. 2500.00.";
  else if (!price && !f.contactForPrice) e.priceLkr = "Enter a price in LKR, or choose Contact for Price.";

  if (f.discountType !== "none") {
    const v = f.discountValue.trim();
    if (!v) e.discountValue = "Enter the discount value.";
    else if (!MONEY.test(v)) e.discountValue = "Enter a number with up to 2 decimals.";
    else if (f.discountType === "percentage" && (cents(v) <= 0n || cents(v) > 10_000n)) {
      e.discountValue = "A percentage discount must be more than 0 and at most 100.";
    } else if (f.discountType === "fixed" && cents(v) <= 0n) {
      e.discountValue = "A fixed discount must be more than LKR 0.";
    } else if (f.discountType === "fixed" && price && MONEY.test(price) && cents(v) > cents(price)) {
      e.discountValue = "A fixed discount cannot be more than the original price.";
    }
    if (!price && !e.priceLkr) e.priceLkr = "Enter a price before adding a discount.";
  }
  if (f.discountEnabled && f.contactForPrice) {
    e.discountEnabled = "Contact for Price products cannot show a discount. Turn the discount off or enter a price.";
  }
  if (f.discountStartsOn && f.discountEndsOn && f.discountStartsOn > f.discountEndsOn) {
    e.discountEndsOn = "The end date must be on or after the start date.";
  }
  return e;
}
