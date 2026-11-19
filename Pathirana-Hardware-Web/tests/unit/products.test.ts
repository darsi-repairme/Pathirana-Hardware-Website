import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogue, productCategories, productTypes } from "../../src/content/products.ts";
import { whatsappProductEnquiryHref } from "../../src/content/business.ts";
import { testimonials } from "../../src/content/testimonials.ts";
import {
  filterProductTypes,
  normalizeQuery,
  productsSearchHref,
  searchProducts,
} from "../../src/lib/product-search.ts";
import {
  addItem,
  enquiryMailto,
  itemCount,
  parseBasket,
  removeItem,
  type BasketItem,
} from "../../src/lib/enquiry-basket.ts";

test("product categories match the client requirements (no invented catalogue)", () => {
  assert.deepEqual(
    productCategories.map((c) => c.title),
    [
      "Building Materials",
      "Steel Products",
      "Plywood",
      "Doors & Windows",
      "Bathroom & Sanitary",
      "Gas Cylinders",
      "Branded Hardware",
    ],
  );
  assert.equal(catalogue.length, 0);
  for (const c of productCategories) {
    assert.doesNotMatch(c.summary, /rs\.?\s?\d|\$|price|discount|in stock|%|partner|official dealer/i);
  }
  const branded = productCategories.find((c) => c.id === "branded-hardware")!;
  for (const brand of ["PE+", "Swisstek", "El Toro", "Würth"]) assert.ok(branded.summary.includes(brand));
});

test("no testimonials are published until real ones are supplied", () => {
  assert.equal(testimonials.length, 0);
});

test("search matches categories by title and everyday terms", () => {
  assert.equal(searchProducts("TOR bars").categories[0]?.id, "steel-products");
  assert.deepEqual(
    searchProducts("  Plywood  ").categories.map((c) => c.id),
    ["plywood"],
  );
  assert.equal(searchProducts("cement").categories[0]?.id, "building-materials");
  assert.equal(searchProducts("gas cylinder").categories[0]?.id, "gas-cylinders");
  assert.equal(searchProducts("bathroom set").categories[0]?.id, "bathroom-sanitary");
  assert.equal(searchProducts("Wurth").categories[0]?.id, "branded-hardware");
  assert.equal(searchProducts("windows").categories[0]?.id, "doors-windows");
});

test("search never invents results", () => {
  assert.deepEqual(searchProducts("solar panel inverter"), { categories: [], productTypes: [], products: [] });
  assert.deepEqual(searchProducts(""), { categories: [], productTypes: [], products: [] });
  assert.deepEqual(searchProducts("a"), { categories: [], productTypes: [], products: [] });
});

test("search query normalisation and products URL", () => {
  assert.equal(normalizeQuery("  Wall   PAINT "), "wall paint");
  assert.equal(normalizeQuery("x".repeat(200)).length, 80);
  assert.equal(productsSearchHref("PVC pipe"), "/products/?q=pvc%20pipe#all-products");
  assert.equal(productsSearchHref("   "), "/products/");
});

test("enquiry basket adds, merges, removes and counts", () => {
  let items: BasketItem[] = [];
  items = addItem(items, { id: "a", name: "Item A" });
  items = addItem(items, { id: "a", name: "Item A" }, 2);
  items = addItem(items, { id: "b", name: "Item B" }, 0);
  assert.deepEqual(items, [
    { id: "a", name: "Item A", quantity: 3 },
    { id: "b", name: "Item B", quantity: 1 },
  ]);
  assert.equal(itemCount(items), 4);
  assert.deepEqual(removeItem(items, "a"), [{ id: "b", name: "Item B", quantity: 1 }]);
});

test("stored basket only keeps well-formed items from the verified catalogue", () => {
  const valid = new Set(["a"]);
  const raw = JSON.stringify([
    { id: "a", name: "Item A", quantity: 2 },
    { id: "fake", name: "Not in catalogue", quantity: 1 },
    { id: "a", name: "Bad qty", quantity: -1 },
    "junk",
  ]);
  assert.deepEqual(parseBasket(raw, valid), [{ id: "a", name: "Item A", quantity: 2 }]);
  assert.deepEqual(parseBasket("not json", valid), []);
  assert.deepEqual(parseBasket(null, valid), []);
  // With the current (empty) catalogue nothing survives — no misleading counts.
  assert.deepEqual(parseBasket(raw, new Set(catalogue.map((p) => p.id))), []);
});

test("enquiry email is a mailto link, not an order", () => {
  const href = enquiryMailto("pathiranahardwarepvt@gmail.com", [{ id: "a", name: "Item A", quantity: 2 }]);
  assert.match(href, /^mailto:pathiranahardwarepvt@gmail\.com\?subject=Product%20enquiry&body=/);
  assert.match(decodeURIComponent(href), /Item A × 2/);
});

test("only the eight documented product types are published, each in a real category", () => {
  assert.deepEqual(
    productTypes.map((p) => p.name),
    ["Cement", "TOR Bars", "Plywood", "Box Bars", "Doors", "Windows", "Bathroom Sets", "Gas Cylinders"],
  );
  const ids = new Set(productCategories.map((c) => c.id));
  assert.equal(new Set(productTypes.map((p) => p.slug)).size, 8);
  for (const p of productTypes) {
    assert.ok(ids.has(p.category), p.slug);
    assert.match(p.slug, /^[a-z0-9-]+$/);
    const text = [p.summary, p.description, ...p.askAbout].join(" ");
    assert.doesNotMatch(text, /rs\.?\s?\d|\$|discount|in stock|%|model no|guarantee|free delivery/i);
  }
  assert.deepEqual(
    productTypes.filter((p) => p.category === "steel-products").map((p) => p.slug),
    ["tor-bars", "box-bars"],
  );
  assert.equal(productTypes.filter((p) => p.category === "branded-hardware").length, 0);
});

test("search and filters work on the documented product types only", () => {
  assert.equal(searchProducts("TOR bars").productTypes[0]?.slug, "tor-bars");
  assert.equal(searchProducts("plywood").productTypes[0]?.slug, "plywood");
  assert.equal(filterProductTypes("", "all").length, 8);
  assert.deepEqual(
    filterProductTypes("", "doors-windows").map((p) => p.slug),
    ["doors", "windows"],
  );
  assert.deepEqual(
    filterProductTypes("door", "doors-windows").map((p) => p.slug),
    ["doors"],
  );
  assert.deepEqual(filterProductTypes("cement", "steel-products"), []);
  assert.deepEqual(filterProductTypes("", "branded-hardware"), []);
  assert.deepEqual(filterProductTypes("solar panel", "all"), []);
});

test("product WhatsApp enquiry is URL-encoded and names the product", () => {
  const href = whatsappProductEnquiryHref("plywood");
  assert.match(href, /^https:\/\/wa\.me\/94712259699\?text=/);
  assert.equal(
    decodeURIComponent(href.split("?text=")[1]!),
    "Hello Pathirana Hardware,\nI would like to enquire about plywood.\nPlease share available options and prices.",
  );
  assert.doesNotMatch(href.split("?text=")[1]!, /[ \n,]/);
});
