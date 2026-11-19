import { test } from "node:test";
import assert from "node:assert/strict";
import { services } from "../../src/content/services.ts";
import { faqGroups } from "../../src/content/faq.ts";

test("all six client-approved services are published", () => {
  assert.deepEqual(
    services.map((s) => s.title),
    [
      "Building Material Supply",
      "Home / Site Delivery",
      "Bulk Orders",
      "Product Reservations",
      "Product Advice & Guidance",
      "Contractor & Project Support",
    ],
  );
  assert.deepEqual(
    services.map((s) => s.id),
    [
      "building-material-supply",
      "home-site-delivery",
      "bulk-orders",
      "product-reservations",
      "product-advice",
      "contractor-support",
    ],
  );
});

test("service copy never invents terms (charges, areas, minimums, discounts, guarantees)", () => {
  for (const s of services) {
    const text = `${s.summary} ${s.description} ${s.howToAsk} ${s.enquireAbout.join(" ")} ${s.share}`;
    assert.doesNotMatch(
      text,
      /free delivery|same[- ]day|guarantee|discount|wholesale price|minimum|rs\.?\s?\d|\d+\s?(km|days?|hours?)|within \d/i,
    );
  }
});

test("FAQ answers stay honest (no online payment, no live AI ordering, no invented terms)", () => {
  const text = faqGroups.flatMap((g) => g.items.map((i) => `${i.question} ${i.answer}`)).join(" ");
  assert.doesNotMatch(
    text,
    /free delivery|same[- ]day|guarantee|discount|rs\.?\s?\d|\d+\s?(km|days?|hours?)|AI (bot|assistant) is/i,
  );
  const pay = faqGroups.flatMap((g) => g.items).find((i) => i.id === "pay-online")!;
  assert.match(pay.answer, /^No\./);
  assert.equal(
    new Set(faqGroups.flatMap((g) => g.items.map((i) => i.id))).size,
    faqGroups.flatMap((g) => g.items).length,
  );
});
