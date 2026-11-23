import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNonPublicHost,
  productEnquiryHref,
  productEnquiryText,
  publicProductUrl,
  shownPriceText,
} from "../../src/lib/product-enquiry.ts";

/** Product names and prices below are TEST values only (never shown on the website). */
const SITE = "https://pathiranahardware.lk";
const NO_SITE = ""; // NEXT_PUBLIC_SITE_URL not configured
const decode = (href: string) => {
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://wa.me/94712259699");
  return url.searchParams.get("text")!;
};

test("normal price: exact client format, final price with unit, public link", () => {
  const text = productEnquiryText(
    {
      name: "Test Cement",
      price: { contactForPrice: false, final: "2500.00" },
      unit: "bag",
      path: "/products/item/?slug=test-cement",
    },
    SITE,
  );
  assert.equal(
    text,
    [
      "Hello Pathirana Hardware,",
      "",
      "I am interested in Test Cement.",
      "Price shown: LKR 2,500.00 / bag.",
      "Quantity: [enter quantity].",
      "My location: [enter location].",
      "Product link: https://pathiranahardware.lk/products/item/?slug=test-cement",
      "",
      "Please confirm availability and delivery charges.",
    ].join("\n"),
  );
});

test("discounted product: only the displayed (final) price, no 'was' price", () => {
  const text = productEnquiryText(
    { name: "Test Sheet", price: { contactForPrice: false, final: "2250" }, path: "/x/" },
    SITE,
  );
  assert.match(text, /^Price shown: LKR 2,250\.00\.$/m);
  assert.doesNotMatch(text, /was|offer|2,500/i);
});

test("Contact for Price (flag, missing final, or no price at all) never becomes 'LKR Contact for Price'", () => {
  for (const price of [
    { contactForPrice: true, final: null },
    { contactForPrice: false, final: null },
    null,
    undefined,
  ]) {
    const text = productEnquiryText({ name: "Test Item", price, unit: "piece" }, SITE);
    assert.match(text, /^Price shown: Contact for Price\.$/m);
    assert.doesNotMatch(text, /LKR/);
  }
  assert.equal(shownPriceText({ contactForPrice: true, final: "100.00" }, "bag"), "Contact for Price");
});

test("reference line only for a genuine reference; never omitted placeholders", () => {
  const without = productEnquiryText({ name: "Test Item", price: null }, SITE);
  assert.doesNotMatch(without, /Product reference/);
  const withRef = productEnquiryText({ name: "Test Item", reference: " TST-001 ", price: null }, SITE);
  assert.match(withRef, /^I am interested in Test Item\.\nProduct reference: TST-001\.\nPrice shown:/m);
  for (const t of [without, withRef]) {
    assert.match(t, /^Quantity: \[enter quantity\]\.$/m);
    assert.match(t, /^My location: \[enter location\]\.$/m);
    assert.ok(t.endsWith("\n\nPlease confirm availability and delivery charges."));
  }
});

test("missing optional fields: no path → no link line; trailing periods in names are not doubled", () => {
  const text = productEnquiryText({ name: "Test Item.", price: null }, SITE);
  assert.match(text, /^I am interested in Test Item\.$/m);
  assert.doesNotMatch(text, /Product link/);
});

test("links: site URL first; browser origin only if public; never localhost/127.0.0.1/private", () => {
  const path = "/products/item/?slug=a-b";
  assert.equal(publicProductUrl(path, "http://127.0.0.1:4173", SITE), `${SITE}${path}`);
  assert.equal(publicProductUrl(path, "https://www.example.lk", NO_SITE), `https://www.example.lk${path}`);
  for (const local of [
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://192.168.1.20:4173",
    "http://10.0.0.5",
    "http://172.20.1.1",
    "http://[::1]:4173",
    "http://shop.local",
  ]) {
    assert.equal(publicProductUrl(path, local, NO_SITE), null, local);
    // A misconfigured local NEXT_PUBLIC_SITE_URL is ignored too.
    assert.equal(publicProductUrl(path, null, local), null, local);
  }
  assert.equal(publicProductUrl(path, "javascript:alert(1)", NO_SITE), null);
  assert.equal(isNonPublicHost("fdomain.lk"), false);
  assert.equal(isNonPublicHost("pathiranahardware.lk"), false);
  const text = productEnquiryText({ name: "Test", price: null, path, origin: "http://127.0.0.1:4173" }, NO_SITE);
  assert.doesNotMatch(text, /127\.0\.0\.1|localhost|Product link/);
});

test("the whole message is URL-encoded and opens the business WhatsApp chat (customer presses Send)", () => {
  const p = {
    name: 'Doors & Windows 50% "Test" #1',
    price: { contactForPrice: false, final: "1234567.5" },
    unit: "sheet",
    path: "/products/item/?slug=doors&x=1",
  };
  const href = productEnquiryHref(p, SITE);
  assert.match(href, /^https:\/\/wa\.me\/94712259699\?text=/);
  const raw = href.split("?text=")[1]!;
  assert.doesNotMatch(raw, /[ \n&#"%](?![0-9A-F]{2})/);
  assert.equal(decode(href), productEnquiryText(p, SITE));
  assert.match(decode(href), /LKR 1,234,567\.50 \/ sheet\./);
  assert.match(decode(href), /slug=doors&x=1$/m);
});
