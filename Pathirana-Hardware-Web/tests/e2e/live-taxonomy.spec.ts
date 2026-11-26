import { expect, test, type Page } from "./fixtures";
import { trackErrors } from "./helpers";

/**
 * Live categories and brands (API build). API responses are mocked with the
 * backend's real shapes — every name below is TEST data, never shown on the
 * live site. The real API ↔ database round trip is covered by
 * tests/live-stack (npm run test:live-stack).
 */
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
test.skip(!API, "the website needs NEXT_PUBLIC_API_URL (live database only)");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqP9fDwAEhgGAWw5cIQAAAABJRU5ErkJggg==",
  "base64",
);
const KEY = "00000000-0000-4000-8000-0000000000a1";

const CATEGORIES = [
  // A category without an uploaded image (icon card)…
  { slug: "plywood", name: "Plywood", description: null, productCount: 0, image: null },
  // …and one staff added, with an uploaded image.
  {
    slug: "test-roofing",
    name: "Test Roofing",
    description: "Test roofing description.",
    productCount: 0,
    image: {
      url: `/api/v1/category-images/${KEY}`,
      thumbUrl: `/api/v1/category-images/${KEY}?size=thumb`,
      alt: "Test roofing photo",
      width: 1,
      height: 1,
    },
  },
];
const BRANDS = [
  { slug: "wurth", name: "Würth", logo: null }, // no upload: name only (bundled logo files are never used)
  { slug: "test-uploaded", name: "Test Uploaded", logo: { url: `/api/v1/brand-logos/${KEY}`, width: 1, height: 1 } },
  { slug: "test-name-only", name: "Test Name Only", logo: null }, // no logo → name, never a generated logo
];

async function mockTaxonomy(page: Page, categories: unknown = CATEGORIES, brands: unknown = BRANDS) {
  const reply = (body: unknown) => (r: import("@playwright/test").Route) =>
    typeof body === "number" ? r.fulfill({ status: body, json: {} }) : r.fulfill({ json: { items: body } });
  await page.route(`${API}/api/v1/categories`, reply(categories));
  await page.route(`${API}/api/v1/brands`, reply(brands));
  await page.route(`${API}/api/v1/category-images/**`, (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route(`${API}/api/v1/brand-logos/**`, (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
  await page.route(`${API}/api/v1/products?**`, (r) =>
    r.fulfill({ json: { items: [], total: 0, page: 1, limit: 12 } }),
  );
}

const homeCards = (page: Page) => page.locator("section[aria-labelledby='products-title'] ul[data-taxonomy-status]");
const brandRow = (page: Page) => page.locator("section[aria-labelledby='brands-title'] ul[data-taxonomy-status]");
const browse = (page: Page) => page.locator("section[aria-labelledby='categories-title'] ul[data-taxonomy-status]");

test.describe("Live categories and brands", () => {
  test("only the active live categories appear on Home, Products and About", async ({ page }) => {
    const errors = trackErrors(page);
    await mockTaxonomy(page);
    await page.goto("/");
    await expect(homeCards(page)).toHaveAttribute("data-taxonomy-status", "live");
    const links = homeCards(page).getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute("href", "/products/category/?slug=plywood");
    await expect(links.nth(1)).toHaveAttribute("href", "/products/category/?slug=test-roofing");
    await expect(links.nth(1)).toContainText("Test roofing description.");
    await expect(links.nth(1).getByRole("img", { name: "Test roofing photo" })).toHaveAttribute(
      "src",
      `${API}/api/v1/category-images/${KEY}`,
    );
    // Categories not in the API's active list never appear.
    await expect(homeCards(page)).not.toContainText("Gas Cylinders");

    await page.goto("/products/");
    await expect(browse(page)).toHaveAttribute("data-taxonomy-status", "live");
    await expect(browse(page).getByRole("link")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "View All Categories" })).toHaveCount(0); // nothing to expand
    await page.goto("/about/");
    await expect(page.locator("ul[data-taxonomy-status='live']").getByRole("link")).toHaveText([
      "Plywood",
      "Test Roofing",
    ]);
    expect(errors).toEqual([]);
  });

  test("Our Brands: uploaded logo, otherwise the name (no bundled logo files)", async ({ page }) => {
    await mockTaxonomy(page);
    await page.goto("/products/");
    await expect(brandRow(page)).toHaveAttribute("data-taxonomy-status", "live");
    await expect(brandRow(page).locator("li")).toHaveCount(3);
    await expect(brandRow(page).getByRole("img", { name: "Würth logo" })).toHaveCount(0);
    await expect(brandRow(page)).toContainText("Würth");
    await expect(brandRow(page).getByRole("img", { name: "Test Uploaded logo" })).toHaveAttribute(
      "src",
      `${API}/api/v1/brand-logos/${KEY}`,
    );
    const nameOnly = brandRow(page).locator("li", { hasText: "Test Name Only" });
    await expect(nameOnly.locator("img")).toHaveCount(0);
    // Deactivated brands (not in the active list) are hidden.
    await expect(brandRow(page).getByRole("img", { name: "PE+ logo" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test("no active entries → honest 'being added'; API down → 'temporarily unavailable' (never documented data)", async ({
    page,
  }) => {
    await mockTaxonomy(page, [], []);
    await page.goto("/products/");
    const brands = page.locator("section[aria-labelledby='brands-title']");
    const cats = page.locator("section[aria-labelledby='categories-title']");
    await expect(brands.locator("[data-taxonomy-notice='empty']")).toContainText("Brands are being added");
    await expect(cats.locator("[data-taxonomy-notice='empty']")).toContainText("Product categories are being added");
    await expect(brands.getByRole("img")).toHaveCount(0); // nothing substituted
    await expect(cats.locator("a[href^='/products/category/']")).toHaveCount(0);
    await page.goto("/");
    await expect(
      page.locator("section[aria-labelledby='products-title'] [data-taxonomy-notice='empty']"),
    ).toBeVisible();
    await page.goto("/about/");
    await expect(page.locator("[data-taxonomy-notice='empty']")).toContainText("being added");

    await page.unrouteAll({ behavior: "ignoreErrors" });
    let down = true;
    await mockTaxonomy(page);
    await page.route(`${API}/api/v1/categories`, (r) =>
      down ? r.fulfill({ status: 503, json: {} }) : r.fulfill({ json: { items: CATEGORIES } }),
    );
    await page.goto("/");
    const home = page.locator("section[aria-labelledby='products-title']");
    await expect(home.locator("[data-taxonomy-notice='error']")).toContainText("Categories temporarily unavailable");
    await expect(home.getByRole("link", { name: /Gas Cylinders/ })).toHaveCount(0);
    down = false;
    await home.getByRole("button", { name: "Try again" }).click();
    await expect(homeCards(page)).toHaveAttribute("data-taxonomy-status", "live");
    await expect(homeCards(page).getByRole("link")).toHaveCount(2);
  });

  test("the built-in category and product-type pages no longer exist", async ({ request }) => {
    for (const path of ["/products/categories/plywood/", "/products/plywood/", "/products/categories/gas-cylinders/"])
      expect((await request.get(path)).status(), path).toBe(404);
  });

  test("live category page: any active category, unknown slug, inactive slug, API down", async ({ page }) => {
    await mockTaxonomy(page);
    await page.goto("/products/category/?slug=test-roofing");
    const live = page.locator("[data-live-category='test-roofing']");
    await expect(live.getByRole("heading", { level: 1 })).toHaveText("Test Roofing");
    await expect(live).toContainText("Test roofing description.");
    await expect(live.getByRole("img", { name: "Test roofing photo" })).toBeVisible();
    await expect(live.getByRole("link", { name: /Enquire on WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
    await expect(live.locator("#other-categories + ul").getByRole("link")).toHaveText(["Plywood"]);

    await page.goto("/products/category/?slug=not-a-category");
    await expect(page.locator("[data-product-state='not-found']")).toContainText("Category not found");

    // A former built-in category is just a live category now (no redirect, no bundled page).
    await page.goto("/products/category/?slug=plywood");
    await expect(page.locator("[data-live-category='plywood'] h1")).toHaveText("Plywood");
    // A category that is not active shows "not found", never bundled content.
    await page.goto("/products/category/?slug=gas-cylinders");
    await expect(page.locator("[data-product-state='not-found']")).toContainText("Category not found");

    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockTaxonomy(page, 503);
    await page.goto("/products/category/?slug=test-roofing");
    await expect(page.locator("[data-product-state='unavailable']")).toContainText("temporarily unavailable");
  });

  test("header search loads live names only when it is used", async ({ page, isMobile }) => {
    const calls: string[] = [];
    await mockTaxonomy(page);
    page.on("request", (r) => r.url().startsWith(`${API}/api/v1/`) && calls.push(new URL(r.url()).pathname));
    await page.goto("/contact/");
    await page.waitForLoadState("networkidle");
    expect(calls).toEqual([]);
    if (isMobile) await page.getByRole("button", { name: "Search products" }).click();
    await page.locator("header input[name=q]:visible").focus();
    await expect.poll(() => calls.sort()).toEqual(["/api/v1/brands", "/api/v1/categories"]);
    await expect(page.locator("header datalist option[value='Test Roofing']").first()).toBeAttached();
  });
});
