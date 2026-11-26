import { expect, test, type Page, type Route } from "./fixtures";
import { expectNoBrokenImages, trackErrors } from "./helpers";

/**
 * Products page + product detail with the live API (Batch 5A).
 * Runs when the site was built with NEXT_PUBLIC_API_URL. API responses are
 * mocked with the backend's real response shapes — every product, brand and
 * price below is TEST DATA only, never shown on the live site.
 */
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

// 1×1 PNG served for mocked product images (served by the real API as WebP).
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqP9fDwAEhgGAWw5cIQAAAABJRU5ErkJggg==",
  "base64",
);
const img = (id: string, alt: string) => ({
  url: `/api/v1/product-images/${id}`,
  thumbUrl: `/api/v1/product-images/${id}?size=thumb`,
  alt,
  width: 800,
  height: 600,
  isMain: id.endsWith("1"),
});
const contact = { currency: "LKR", contactForPrice: true, original: null, discount: null, final: null };

const DISCOUNTED = {
  slug: "test-discounted",
  name: "Test Discounted Item",
  summary: "Test summary.",
  category: { slug: "building-materials", name: "Building Materials" },
  brands: [{ slug: "test-brand", name: "Test Brand" }],
  unit: "bag",
  availability: "available",
  price: {
    currency: "LKR",
    contactForPrice: false,
    original: "2500.00",
    discount: { type: "percentage", value: "10.00", amount: "250.00", startsOn: null, endsOn: "2099-12-31" },
    final: "2250.00",
  },
  image: img("00000000-0000-4000-8000-000000000001", "Test discounted main image"),
};
const CONTACT = {
  slug: "test-contact",
  name: "Test Contact Item",
  summary: null,
  category: { slug: "steel-products", name: "Steel Products" },
  brands: [],
  unit: null,
  availability: "out_of_stock",
  price: contact,
  image: null,
};
const page1 = (items: unknown[], total = items.length) => ({ items, total, page: 1, limit: 12 });

async function mockApi(page: Page, products: (url: URL) => unknown | number) {
  await page.route(`${API}/api/v1/categories`, (r) =>
    r.fulfill({
      json: {
        items: [
          { slug: "building-materials", name: "Building Materials", description: null, productCount: 1 },
          { slug: "steel-products", name: "Steel Products", description: null, productCount: 1 },
        ],
      },
    }),
  );
  await page.route(`${API}/api/v1/brands`, (r) =>
    r.fulfill({ json: { items: [{ slug: "test-brand", name: "Test Brand" }] } }),
  );
  await page.route(`${API}/api/v1/product-images/**`, (r) =>
    r.fulfill({ body: PIXEL, contentType: "image/png", headers: { "Cross-Origin-Resource-Policy": "cross-origin" } }),
  );
  await page.route(`${API}/api/v1/products?**`, (r: Route) => {
    const res = products(new URL(r.request().url()));
    return typeof res === "number" ? r.fulfill({ status: res, json: {} }) : r.fulfill({ json: res });
  });
}

const catalogue = (page: Page) => page.locator("[data-catalogue='live']");

test.describe("Live product catalogue", () => {
  test.skip(!API, "build without NEXT_PUBLIC_API_URL (the documented product types are shown instead)");

  test("published products: image, category/brand, unit, discount, final price, availability", async ({ page }) => {
    const errors = trackErrors(page);
    await mockApi(page, () => page1([DISCOUNTED, CONTACT]));
    await page.goto("/products/");
    await expect(catalogue(page)).toHaveAttribute("data-catalogue-state", "ready");
    await expect(catalogue(page)).toContainText("2 products");

    const d = page.locator("[data-product='test-discounted']");
    await expect(d.getByRole("link", { name: "Test Discounted Item", exact: true })).toHaveAttribute(
      "href",
      "/products/item/?slug=test-discounted",
    );
    await expect(d).toContainText("Building Materials · Test Brand");
    await expect(d).toContainText("LKR 2,500.00");
    await expect(d).toContainText("10% off");
    await expect(d).toContainText("LKR 2,250.00 / bag");
    await expect(d.locator("[data-availability]")).toHaveText("Available");
    // Product card enquiry: the shared client format with the DISPLAYED (discounted) price only.
    const waText = async (card: typeof d) => {
      const href = (await card.getByRole("link", { name: /Enquire on WhatsApp/ }).getAttribute("href"))!;
      expect(href.startsWith("https://wa.me/94712259699?text=")).toBe(true);
      return new URL(href).searchParams.get("text")!;
    };
    const dText = await waText(d);
    expect(dText).toMatch(
      /^Hello Pathirana Hardware,\n\nI am interested in Test Discounted Item\.\nPrice shown: LKR 2,250\.00 \/ bag\.\nQuantity: \[enter quantity\]\.\nMy location: \[enter location\]\.\n/,
    );
    expect(dText).not.toMatch(/2,500|Product reference|127\.0\.0\.1|localhost/);
    expect(dText.endsWith("\n\nPlease confirm availability and delivery charges.")).toBe(true);

    // Contact for Price: no price or discount; out of stock is never shown as available.
    const c = page.locator("[data-product='test-contact']");
    await expect(c.locator("[data-price]")).toHaveText("Contact for Price");
    await expect(c).not.toContainText("LKR");
    await expect(c.locator("[data-availability]")).toHaveText("Out of Stock");
    const cText = await waText(c);
    expect(cText).toContain("\nI am interested in Test Contact Item.\nPrice shown: Contact for Price.\n");
    expect(cText).not.toContain("LKR");
    await expectNoBrokenImages(page);
    expect(errors).toEqual([]);
  });

  test("search, category and brand filters query the API", async ({ page }) => {
    const seen: string[] = [];
    await mockApi(page, (u) => {
      seen.push(u.search);
      return u.searchParams.get("q") === "nothing" ? page1([]) : page1([DISCOUNTED]);
    });
    await page.goto("/products/?category=building-materials");
    await expect(catalogue(page)).toHaveAttribute("data-catalogue-state", "ready");
    expect(seen.at(-1)).toContain("category=building-materials");

    await page.getByLabel("Filter by brand").selectOption("test-brand");
    await expect.poll(() => seen.at(-1)).toContain("brand=test-brand");
    await page.getByLabel("Search products by name").fill("nothing");
    await expect(catalogue(page)).toHaveAttribute("data-catalogue-state", "no-match");
    expect(seen.at(-1)).toContain("q=nothing");
    await expect(page).toHaveURL(/q=nothing/);
    await page.getByRole("button", { name: "Show all products" }).click();
    await expect(catalogue(page)).toHaveAttribute("data-catalogue-state", "ready");
    expect(seen.at(-1)).not.toContain("category=");
  });

  test("pagination", async ({ page }) => {
    await mockApi(page, (u) => ({ ...page1([DISCOUNTED], 30), page: Number(u.searchParams.get("page")) }));
    await page.goto("/products/");
    await expect(page.getByText("Page 1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Page 2 of 3")).toBeVisible();
  });

  test("no published products → helpful empty state; API down → temporarily unavailable + retry", async ({ page }) => {
    let down = true;
    await mockApi(page, () => (down ? 503 : page1([])));
    await page.goto("/products/");
    await expect(catalogue(page)).toHaveAttribute("data-catalogue-state", "error");
    await expect(catalogue(page)).toContainText("Product list temporarily unavailable");
    await expect(catalogue(page).locator("[data-product]")).toHaveCount(0); // nothing substituted
    down = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(catalogue(page)).toHaveAttribute("data-catalogue-state", "empty");
    await expect(catalogue(page)).toContainText("Products are being added");
  });

  test("detail page: navigation, images, price, availability; not found and unavailable", async ({ page }) => {
    const errors = trackErrors(page);
    await mockApi(page, () => page1([DISCOUNTED]));
    await page.route(`${API}/api/v1/products/test-discounted`, (r) =>
      r.fulfill({
        json: {
          ...DISCOUNTED,
          description: "Test description.",
          images: [DISCOUNTED.image, img("00000000-0000-4000-8000-000000000002", "Test second image")],
        },
      }),
    );
    await page.route(`${API}/api/v1/products/test-draft`, (r) => r.fulfill({ status: 404, json: {} }));
    await page.route(`${API}/api/v1/products/test-down`, (r) => r.fulfill({ status: 503, json: {} }));

    await page.goto("/products/");
    await page.getByRole("link", { name: "Test Discounted Item", exact: true }).click();
    await expect(page).toHaveURL(/\/products\/item\/\?slug=test-discounted$/);
    const detail = page.locator("[data-product-detail='test-discounted']");
    await expect(detail.getByRole("heading", { level: 1 })).toHaveText("Test Discounted Item");
    await expect(detail).toContainText("Category: Building Materials");
    await expect(detail).toContainText("Brand: Test Brand");
    await expect(detail).toContainText("LKR 2,250.00");
    await expect(detail).toContainText("You save LKR 250.00 · offer ends 31 Dec 2099");
    await expect(detail).toContainText("Unit of sale: bag");
    await expect(detail.locator("[data-availability]")).toHaveText("Available");
    await expect(page).toHaveTitle(/Test Discounted Item/);
    await expect(detail.getByRole("img", { name: "Test discounted main image" })).toBeVisible();
    await detail.getByRole("button", { name: /Show image 2/ }).click();
    await expect(detail.getByRole("img", { name: "Test second image" })).toBeVisible();
    await expectNoBrokenImages(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/products\/$/);

    await page.goto("/products/item/?slug=test-draft");
    await expect(page.locator("[data-product-state='not-found']")).toContainText("Product not found");
    await page.goto("/products/item/?slug=test-down");
    await expect(page.locator("[data-product-state='unavailable']")).toContainText("temporarily unavailable");
    await page.goto("/products/item/");
    await expect(page.locator("[data-product-state='not-found']")).toBeVisible();
    expect(errors.filter((e) => !/40[4]|503/.test(e))).toEqual([]);
  });

  // Audit PERF-02: on phones the footer showed below the short loading skeleton, then jumped away.
  test("detail page on a phone: no layout shift while the product loads", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockApi(page, () => page1([DISCOUNTED]));
    await page.route(`${API}/api/v1/products/test-discounted`, async (r) => {
      await new Promise((res) => setTimeout(res, 600)); // a visible loading phase
      await r.fulfill({ json: { ...DISCOUNTED, description: "Test description." } });
    });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as PerformanceEntry[] & { value: number; hadRecentInput: boolean }[])
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/products/item/?slug=test-discounted");
    await expect(page.locator("[data-product-detail='test-discounted']")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.1);
  });

  test("existing product-type and category URLs still work; category page lists live products", async ({ page }) => {
    await mockApi(page, (u) =>
      u.searchParams.get("category") === "building-materials" ? page1([DISCOUNTED]) : page1([]),
    );
    await page.goto("/products/cement/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cement");
    await page.goto("/products/categories/building-materials/");
    const live = page.locator("[data-catalogue='category']");
    await expect(live).toHaveAttribute("data-catalogue-state", "ready");
    await expect(live.locator("[data-product='test-discounted']")).toBeVisible();
    // A category with no published products shows no empty live section.
    await page.goto("/products/categories/plywood/");
    await expect(page.locator("[data-catalogue='category']")).toHaveCount(0, { timeout: 10_000 });
  });

  test("cards fit small phones without horizontal scrolling", async ({ page }) => {
    await mockApi(page, () => page1([DISCOUNTED, CONTACT]));
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/products/");
      await expect(catalogue(page)).toHaveAttribute("data-catalogue-state", "ready");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
});
