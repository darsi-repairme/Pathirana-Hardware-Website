/**
 * The ONE authoritative price / discount calculation. Used by the public API,
 * the admin API and the admin price preview, so they always agree.
 *
 * Money is handled as exact integer cents (BigInt) from the NUMERIC strings
 * PostgreSQL returns — never floating point. A final price submitted by a
 * browser is never accepted (unknown body fields are rejected).
 */

export const DISCOUNT_TYPES = ["none", "percentage", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export const AVAILABILITY = ["available", "out_of_stock", "on_request"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** LKR amount with up to two decimals, at most 9,999,999,999.99 (NUMERIC(12,2)). */
export const MONEY = /^\d{1,10}(\.\d{1,2})?$/;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PricingFields = {
  priceLkr: string | null;
  contactForPrice: boolean;
  discountType: DiscountType;
  discountValue: string | null;
  discountEnabled: boolean;
  discountStartsOn: string | null;
  discountEndsOn: string | null;
};

export type DiscountStatus = "none" | "disabled" | "scheduled" | "expired" | "active";

export type Price = {
  currency: "LKR";
  contactForPrice: boolean;
  /** Original price (null for Contact for Price). */
  original: string | null;
  /** Only an offer that is enabled and valid today. */
  discount: {
    type: "percentage" | "fixed";
    value: string;
    amount: string;
    startsOn: string | null;
    endsOn: string | null;
  } | null;
  /** Final selling price (null for Contact for Price). */
  final: string | null;
};

export function toCents(amount: string): bigint {
  if (!MONEY.test(amount)) throw new Error(`Invalid amount: ${amount}`);
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, "0"));
}

export function fromCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

/** Today's date (YYYY-MM-DD) in Sri Lanka, where discount dates apply. */
export function colomboToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(now);
}

function isRealDate(d: string): boolean {
  if (!DATE.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, day));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === day;
}

/** Normalises related fields (no discount type → no value, not enabled). */
export function normalisePricing(p: PricingFields): PricingFields {
  return p.discountType === "none" ? { ...p, discountValue: null, discountEnabled: false } : p;
}

/** Validation messages for a complete set of pricing fields ([] = valid). */
export function pricingProblems(p: PricingFields): string[] {
  const problems: string[] = [];
  const price = p.priceLkr !== null && MONEY.test(p.priceLkr) ? toCents(p.priceLkr) : null;
  if (p.priceLkr !== null && price === null) {
    problems.push("Enter the price as an LKR amount with up to 2 decimals, for example 2500.00.");
  }
  if (!p.contactForPrice && p.priceLkr === null) {
    problems.push("Enter a price in LKR, or choose Contact for Price.");
  }

  if (p.discountType !== "none") {
    const value = p.discountValue !== null && MONEY.test(p.discountValue) ? toCents(p.discountValue) : null;
    if (p.discountValue === null) problems.push("Enter the discount value.");
    else if (value === null) problems.push("Enter the discount value as a number with up to 2 decimals.");
    else if (p.discountType === "percentage" && (value <= 0n || value > 10_000n)) {
      problems.push("A percentage discount must be more than 0 and at most 100.");
    } else if (p.discountType === "fixed" && value <= 0n) {
      problems.push("A fixed discount must be more than LKR 0.");
    } else if (p.discountType === "fixed" && price !== null && value > price) {
      problems.push("A fixed discount cannot be more than the original price.");
    }
    if (p.priceLkr === null) problems.push("Enter a price before adding a discount.");
  }
  if (p.discountEnabled && p.discountType === "none")
    problems.push("Choose a discount type before enabling it.");
  if (p.discountEnabled && p.contactForPrice) {
    problems.push(
      "Contact for Price products cannot show a discount. Turn the discount off or enter a price.",
    );
  }

  for (const [label, d] of [
    ["start", p.discountStartsOn],
    ["end", p.discountEndsOn],
  ] as const) {
    if (d !== null && !isRealDate(d)) problems.push(`The discount ${label} date is not a valid date.`);
  }
  if (
    p.discountStartsOn &&
    p.discountEndsOn &&
    isRealDate(p.discountStartsOn) &&
    isRealDate(p.discountEndsOn) &&
    p.discountStartsOn > p.discountEndsOn
  ) {
    problems.push("The discount end date must be on or after the start date.");
  }
  return problems;
}

export function discountStatus(p: PricingFields, today = colomboToday()): DiscountStatus {
  if (p.discountType === "none" || p.discountValue === null) return "none";
  if (!p.discountEnabled || p.contactForPrice || p.priceLkr === null) return "disabled";
  if (p.discountStartsOn && p.discountStartsOn > today) return "scheduled";
  if (p.discountEndsOn && p.discountEndsOn < today) return "expired";
  return "active";
}

/** Discount in cents: percentages round half-up to the nearest cent; never more than the price. */
export function discountCents(priceCents: bigint, type: "percentage" | "fixed", value: string): bigint {
  const v = toCents(value);
  const amount = type === "percentage" ? (priceCents * v + 5_000n) / 10_000n : v;
  return amount > priceCents ? priceCents : amount;
}

/**
 * The price a customer sees. Contact for Price never exposes a price or a
 * discount; a disabled, scheduled or expired discount is not an offer.
 */
export function computePrice(p: PricingFields, today = colomboToday()): Price {
  if (p.contactForPrice || p.priceLkr === null) {
    return { currency: "LKR", contactForPrice: true, original: null, discount: null, final: null };
  }
  const original = toCents(p.priceLkr);
  if (discountStatus(p, today) !== "active") {
    const s = fromCents(original);
    return { currency: "LKR", contactForPrice: false, original: s, discount: null, final: s };
  }
  const type = p.discountType as "percentage" | "fixed";
  const amount = discountCents(original, type, p.discountValue!);
  return {
    currency: "LKR",
    contactForPrice: false,
    original: fromCents(original),
    discount: {
      type,
      value: fromCents(toCents(p.discountValue!)),
      amount: fromCents(amount),
      startsOn: p.discountStartsOn,
      endsOn: p.discountEndsOn,
    },
    final: fromCents(original - amount),
  };
}
