import {
  colomboToday,
  computePrice,
  discountCents,
  discountStatus,
  fromCents,
  normalisePricing,
  pricingProblems,
  toCents,
  type PricingFields,
} from "./pricing";

// Test data only — never a real product price.
const base: PricingFields = {
  priceLkr: "2500.00",
  contactForPrice: false,
  discountType: "none",
  discountValue: null,
  discountEnabled: false,
  discountStartsOn: null,
  discountEndsOn: null,
};
const TODAY = "2026-11-17";

describe("pricing (single authoritative calculation)", () => {
  it("converts LKR amounts exactly (no floating point)", () => {
    expect(toCents("2500")).toBe(250_000n);
    expect(toCents("0.1")).toBe(10n);
    expect(toCents("9999999999.99")).toBe(999_999_999_999n);
    expect(fromCents(225_000n)).toBe("2250.00");
    expect(fromCents(5n)).toBe("0.05");
    expect(() => toCents("1.234")).toThrow();
    expect(() => toCents("-1")).toThrow();
  });

  it("10% of LKR 2,500.00 → LKR 2,250.00", () => {
    const p = { ...base, discountType: "percentage" as const, discountValue: "10", discountEnabled: true };
    expect(computePrice(p, TODAY)).toEqual({
      currency: "LKR",
      contactForPrice: false,
      original: "2500.00",
      discount: { type: "percentage", value: "10.00", amount: "250.00", startsOn: null, endsOn: null },
      final: "2250.00",
    });
  });

  it("fixed LKR discounts, half-up cent rounding for percentages, never negative", () => {
    const fixed = { ...base, discountType: "fixed" as const, discountValue: "300.50", discountEnabled: true };
    expect(computePrice(fixed, TODAY).final).toBe("2199.50");
    expect(discountCents(toCents("0.05"), "percentage", "50")).toBe(3n); // 2.5 cents → 3
    expect(discountCents(toCents("99.99"), "percentage", "33.33")).toBe(3333n); // 3332.6667 → 3333
    const all = { ...base, discountType: "percentage" as const, discountValue: "100", discountEnabled: true };
    expect(computePrice(all, TODAY).final).toBe("0.00");
    const whole = { ...fixed, discountValue: "2500" };
    expect(computePrice(whole, TODAY).final).toBe("0.00");
  });

  it("Contact for Price never exposes a price or a discount", () => {
    const p = { ...base, contactForPrice: true, discountType: "percentage" as const, discountValue: "10" };
    expect(computePrice(p, TODAY)).toEqual({
      currency: "LKR",
      contactForPrice: true,
      original: null,
      discount: null,
      final: null,
    });
    expect(computePrice({ ...base, priceLkr: null, contactForPrice: true }, TODAY).final).toBeNull();
  });

  it("disabled, scheduled and expired discounts are not offers; date bounds are inclusive", () => {
    const d = { ...base, discountType: "percentage" as const, discountValue: "10", discountEnabled: true };
    expect(discountStatus({ ...d, discountEnabled: false }, TODAY)).toBe("disabled");
    expect(computePrice({ ...d, discountEnabled: false }, TODAY).discount).toBeNull();
    expect(discountStatus({ ...d, discountStartsOn: "2026-11-18" }, TODAY)).toBe("scheduled");
    expect(computePrice({ ...d, discountStartsOn: "2026-11-18" }, TODAY).final).toBe("2500.00");
    expect(discountStatus({ ...d, discountEndsOn: "2026-11-16" }, TODAY)).toBe("expired");
    expect(discountStatus({ ...d, discountStartsOn: TODAY, discountEndsOn: TODAY }, TODAY)).toBe("active");
    expect(discountStatus(base, TODAY)).toBe("none");
  });

  it("rejects invalid prices and discounts with clear messages", () => {
    const pct = (v: string) => ({ ...base, discountType: "percentage" as const, discountValue: v });
    expect(pricingProblems(base)).toEqual([]);
    expect(pricingProblems({ ...base, priceLkr: null })).toContain(
      "Enter a price in LKR, or choose Contact for Price.",
    );
    expect(pricingProblems(pct("100.01"))).toContain(
      "A percentage discount must be more than 0 and at most 100.",
    );
    expect(pricingProblems(pct("0"))).toContain("A percentage discount must be more than 0 and at most 100.");
    expect(pricingProblems({ ...base, discountType: "fixed", discountValue: "2500.01" })).toContain(
      "A fixed discount cannot be more than the original price.",
    );
    expect(pricingProblems({ ...pct("5"), priceLkr: null, contactForPrice: true })).toContain(
      "Enter a price before adding a discount.",
    );
    expect(pricingProblems({ ...pct("5"), contactForPrice: true, discountEnabled: true })[0]).toMatch(
      /Contact for Price products cannot show a discount/,
    );
    expect(
      pricingProblems({ ...pct("5"), discountStartsOn: "2026-12-02", discountEndsOn: "2026-12-01" }),
    ).toContain("The discount end date must be on or after the start date.");
    expect(pricingProblems({ ...pct("5"), discountEndsOn: "2026-02-30" })).toContain(
      "The discount end date is not a valid date.",
    );
    expect(pricingProblems({ ...base, priceLkr: "12.345" })[0]).toMatch(/up to 2 decimals/);
  });

  it("normalises 'no discount' and uses Sri Lanka dates", () => {
    expect(normalisePricing({ ...base, discountValue: "5", discountEnabled: true })).toMatchObject({
      discountValue: null,
      discountEnabled: false,
    });
    // 2026-11-17 19:00 UTC is already 18 November in Sri Lanka (UTC+05:30).
    expect(colomboToday(new Date("2026-11-17T19:00:00Z"))).toBe("2026-11-18");
  });
});
