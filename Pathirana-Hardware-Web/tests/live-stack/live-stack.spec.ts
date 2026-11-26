import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ADMIN } from "./global-setup";
import { LIVE_API_PORT } from "./ports.mjs";

/**
 * REAL end-to-end: staff changes made through the website API (the same calls
 * the Admin dashboard's gateway makes) → throwaway PostgreSQL → the public
 * website (static build, no rebuild between steps). Every name and price here
 * is TEST data in the throwaway database only (LKR 2,500.00 − 10% is the
 * agreed test example; it is never a real price).
 */
const API = `http://127.0.0.1:${LIVE_API_PORT}`;
const backend = createRequire(path.resolve(import.meta.dirname, "../../../Pathirana-Hardware-Backend/package.json"));
const sharp = backend("sharp") as (o: object) => { png(): { toBuffer(): Promise<Buffer> } };
const png = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 4, background } })
    .png()
    .toBuffer();

let api: APIRequestContext;
test.beforeAll(async ({ playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: API });
  const login = await anon.post("/api/v1/auth/login", { data: ADMIN });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  await anon.dispose();
  api = await playwright.request.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });
});
test.afterAll(async () => api?.dispose());

async function call(
  method: "post" | "patch" | "delete",
  url: string,
  options: Parameters<APIRequestContext["post"]>[1] = {},
) {
  const res = await api[method](url, options);
  expect(res.ok(), `${method.toUpperCase()} ${url} → ${res.status()} ${await res.text()}`).toBe(true);
  return res.status() === 204 ? null : res.json();
}

/** Loaded (non-broken) image. */
async function expectLoaded(img: ReturnType<Page["locator"]>) {
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
}

test("staff changes reach every public section without a rebuild", async ({ page }, info) => {
  const t = info.project.name === "mobile" ? "M" : "D";
  const catName = `Live Test Category ${t}`;
  const catSlug = `live-test-category-${t.toLowerCase()}`;
  const brandName = `Live Test Brand ${t}`;
  const productName = `Live Test Product ${t}`;
  const productSlug = `live-test-product-${t.toLowerCase()}`;
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !/40[34]/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  const homeCards = () => page.locator("section[aria-labelledby='products-title'] ul[data-taxonomy-status]");
  const browse = () => page.locator("section[aria-labelledby='categories-title'] ul[data-taxonomy-status]");
  const brandRow = () => page.locator("section[aria-labelledby='brands-title'] ul[data-taxonomy-status]");

  if (t === "D") {
    await test.step("Fresh database: honest empty states, no documented data substituted", async () => {
      await page.goto("/products/");
      await expect(
        page.locator("section[aria-labelledby='brands-title'] [data-taxonomy-notice='empty']"),
      ).toBeVisible();
      await expect(
        page.locator("section[aria-labelledby='categories-title'] [data-taxonomy-notice='empty']"),
      ).toBeVisible();
      await page.goto("/products/category/?slug=plywood");
      await expect(page.locator("[data-product-state='not-found']")).toContainText("Category not found");
    });
  }

  let categoryId = "";
  await test.step("Add category → Home, Products and About show it; its live page opens", async () => {
    categoryId = (
      await call("post", "/api/v1/admin/categories", {
        data: { name: catName, description: "Isolated test category." },
      })
    ).id;
    await page.goto("/");
    await expect(homeCards()).toHaveAttribute("data-taxonomy-status", "live");
    const card = homeCards().getByRole("link", { name: new RegExp(catName) });
    await expect(card).toHaveAttribute("href", `/products/category/?slug=${catSlug}`);
    await expect(card).toContainText("Isolated test category.");

    await page.goto("/products/");
    await expect(browse().getByRole("link", { name: catName })).toHaveAttribute(
      "href",
      `/products/category/?slug=${catSlug}`,
    );
    await expect(page.getByLabel("Filter by category").locator(`option[value='${catSlug}']`)).toHaveCount(1);
    await page.goto("/about/");
    await expect(page.locator("ul[data-taxonomy-status='live']").getByRole("link", { name: catName })).toBeVisible();

    await page.goto(`/products/category/?slug=${catSlug}`);
    const live = page.locator(`[data-live-category='${catSlug}']`);
    await expect(live.getByRole("heading", { level: 1 })).toHaveText(catName);
    await expect(live).toContainText("Isolated test category.");
    await expect(live).toContainText("not listed online yet");
    await expect(page).toHaveTitle(new RegExp(catName));
  });

  await test.step("Edit category and upload its image → the website updates", async () => {
    await call("patch", `/api/v1/admin/categories/${categoryId}`, { data: { name: `${catName} Edited` } });
    await call("post", `/api/v1/admin/categories/${categoryId}/image`, {
      multipart: {
        file: { name: "c.png", mimeType: "image/png", buffer: await png(1200, 800, "#0f5d3a") },
        altText: "Isolated test category photo",
      },
    });
    await page.goto("/");
    const card = homeCards().getByRole("link", { name: new RegExp(`${catName} Edited`) });
    await expect(card).toBeVisible();
    const img = card.getByRole("img", { name: "Isolated test category photo" });
    await expect(img).toHaveAttribute("src", new RegExp(`^${API}/api/v1/category-images/`));
    await expectLoaded(img);
  });

  let brandId = "";
  await test.step("Add brand → Products page shows its NAME (no logo yet); upload logo → the logo shows", async () => {
    brandId = (await call("post", "/api/v1/admin/brands", { data: { name: brandName } })).id;
    await page.goto("/products/");
    await expect(brandRow()).toHaveAttribute("data-taxonomy-status", "live");
    const item = brandRow().locator("li", { hasText: brandName });
    await expect(item).toBeVisible();
    await expect(item.locator("img")).toHaveCount(0); // never a generated logo
    await expect(page.getByLabel("Filter by brand").locator("option", { hasText: brandName })).toHaveCount(1);

    await call("post", `/api/v1/admin/brands/${brandId}/logo`, {
      multipart: { file: { name: "logo.png", mimeType: "image/png", buffer: await png(320, 120, "#b8860b") } },
    });
    await page.goto("/products/");
    const logo = brandRow().getByRole("img", { name: `${brandName} logo` });
    await expect(logo).toHaveAttribute("src", new RegExp(`^${API}/api/v1/brand-logos/`));
    await expectLoaded(logo);
  });

  let productId = "";
  await test.step("Add product (draft) → hidden; publish → listed with image, unit and final price", async () => {
    productId = (
      await call("post", "/api/v1/admin/products", {
        data: {
          name: productName,
          categoryId,
          brandIds: [brandId],
          summary: "Isolated test product.",
          unit: "bag",
          priceLkr: "2500.00",
          contactForPrice: false,
          discountType: "percentage",
          discountValue: "10",
          discountEnabled: true,
          availability: "available",
        },
      })
    ).id;
    await call("post", `/api/v1/admin/products/${productId}/images`, {
      multipart: {
        file: { name: "p.png", mimeType: "image/png", buffer: await png(800, 600, "#1f1f1f") },
        altText: "Isolated test product photo",
      },
    });
    await page.goto(`/products/?q=${encodeURIComponent(productName)}`);
    await expect(page.locator(`[data-product='${productSlug}']`)).toHaveCount(0);
    await page.goto(`/products/item/?slug=${productSlug}`);
    await expect(page.locator("[data-product-state='not-found']")).toBeVisible();

    await call("patch", `/api/v1/admin/products/${productId}/publication`, { data: { published: true } });
    await page.goto("/products/");
    const card = page.locator(`[data-product='${productSlug}']`);
    await expect(card).toContainText(`${catName} Edited · ${brandName}`);
    await expect(card).toContainText("LKR 2,500.00");
    await expect(card).toContainText("10% off");
    await expect(card).toContainText("LKR 2,250.00 / bag");
    await expect(card.locator("[data-availability]")).toHaveText("Available");
    // Card image is decorative (the product name is the link text).
    await expect(card.locator("img")).toHaveAttribute("src", new RegExp(`^${API}/api/v1/product-images/`));
    await expectLoaded(card.locator("img"));

    // Search by the brand NAME and filter by the category both find it.
    await page.goto(`/products/?q=${encodeURIComponent(brandName)}`);
    await expect(page.locator(`[data-product='${productSlug}']`)).toBeVisible();
    await page.goto(`/products/?category=${catSlug}`);
    await expect(page.locator(`[data-product='${productSlug}']`)).toBeVisible();

    await page.goto(`/products/category/?slug=${catSlug}`);
    await expect(page.locator(`[data-product='${productSlug}']`)).toBeVisible();
    await page.locator(`[data-product='${productSlug}']`).getByRole("link", { name: productName, exact: true }).click();
    const detail = page.locator(`[data-product-detail='${productSlug}']`);
    await expect(detail.getByRole("heading", { level: 1 })).toHaveText(productName);
    await expect(detail).toContainText("LKR 2,250.00");
    await expect(detail).toContainText("Unit of sale: bag");
    await expect(detail.getByRole("link", { name: `${catName} Edited` }).first()).toHaveAttribute(
      "href",
      `/products/category/?slug=${catSlug}`,
    );
  });

  await test.step("Edit product (Contact for Price, Out of Stock) → the website updates", async () => {
    await call("patch", `/api/v1/admin/products/${productId}`, {
      data: { contactForPrice: true, discountEnabled: false, availability: "out_of_stock" },
    });
    await page.goto("/products/");
    const card = page.locator(`[data-product='${productSlug}']`);
    await expect(card.locator("[data-price]")).toHaveText("Contact for Price");
    await expect(card).not.toContainText("LKR");
    await expect(card.locator("[data-availability]")).toHaveText("Out of Stock");
  });

  await test.step("Unpublish product → hidden from the list and its detail page", async () => {
    await call("patch", `/api/v1/admin/products/${productId}/publication`, { data: { published: false } });
    await page.goto("/products/");
    await expect(page.locator("[data-catalogue='live']")).not.toHaveAttribute("data-catalogue-state", "loading");
    await expect(page.locator(`[data-product='${productSlug}']`)).toHaveCount(0);
    await page.goto(`/products/item/?slug=${productSlug}`);
    await expect(page.locator("[data-product-state='not-found']")).toBeVisible();
  });

  await test.step("Deactivate brand and category → hidden from every public section", async () => {
    await call("patch", `/api/v1/admin/brands/${brandId}/status`, { data: { isActive: false } });
    await call("patch", `/api/v1/admin/categories/${categoryId}/status`, { data: { isActive: false } });
    await page.goto("/products/");
    await expect(page.getByLabel("Filter by category").locator(`option[value='${catSlug}']`)).toHaveCount(0);
    // Nothing active is left in this throwaway database → honest "being added" states, and the
    // deactivated entries (or documented data) never reappear.
    const brandsSection = page.locator("section[aria-labelledby='brands-title']");
    const categoriesSection = page.locator("section[aria-labelledby='categories-title']");
    await expect(brandsSection.locator("[data-taxonomy-status]").first()).not.toHaveAttribute(
      "data-taxonomy-status",
      "loading",
    );
    await expect(brandsSection).not.toContainText(brandName);
    await expect(categoriesSection).not.toContainText(catName);
    if (t === "M") {
      await expect(brandsSection.locator("[data-taxonomy-notice='empty']")).toBeVisible();
      await expect(categoriesSection.locator("[data-taxonomy-notice='empty']")).toBeVisible();
    }
    await page.goto("/");
    const home = page.locator("section[aria-labelledby='products-title']");
    await expect(home.locator("[data-taxonomy-status]").first()).not.toHaveAttribute("data-taxonomy-status", "loading");
    await expect(home).not.toContainText(catName);
    await page.goto(`/products/category/?slug=${catSlug}`);
    await expect(page.locator("[data-product-state='not-found']")).toContainText("Category not found");
  });

  await test.step("Add delivery area (with a fee) → the Home checker recognises it; no charges shown", async () => {
    const town = `Live Test Town ${t}`;
    await call("post", "/api/v1/admin/delivery-areas", {
      data: { name: town, district: "Test District", feeLkr: 400 },
    });
    await page.goto("/");
    const s = page.locator("section[data-delivery-state]");
    await s.scrollIntoViewIfNeeded();
    await expect(s).toHaveAttribute("data-delivery-state", "ready");
    await s.getByLabel("Your town, area or postal code").fill(town);
    await s.getByRole("button", { name: "Check Availability" }).click();
    await expect(s).toContainText(`Yes — we deliver to ${town}, Test District.`);
    await expect(s).not.toContainText(/Delivery fee|LKR|400/);
    await s.getByLabel("Your town, area or postal code").fill("Nowhere Test Place");
    await s.getByRole("button", { name: "Check Availability" }).click();
    await expect(s).not.toContainText("Yes — we deliver");
    await expect(s.getByRole("link", { name: /on WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
  });

  await test.step("Quotation request through the real form → saved with items and a PRIVATE photo", async () => {
    const town = `Live Test Town ${t}`;
    await page.goto(`/quotation/?product=${encodeURIComponent("Live Test Quote Item")}`);
    await expect(page.getByLabel("Location").locator(`option[value='${town}']`)).toHaveCount(1);
    await page.getByLabel("Name").fill(`Live Test Customer ${t}`);
    await page.getByLabel("Phone / WhatsApp number").fill("071 234 5678");
    await page.getByLabel("Location").selectOption(town);
    await page.getByLabel("Quantity").first().fill("12");
    await page.getByPlaceholder("bag, piece…").first().fill("bag");
    await page.getByRole("button", { name: "Add another product" }).click();
    await page.getByLabel("Product 2").fill("Live Test Second Item");
    await page.getByLabel("Quantity").nth(1).fill("3");
    await page.getByLabel("Delivery address").fill("Isolated test address");
    await page
      .locator("input[type=file][name=photos]")
      .setInputFiles({ name: "ref.png", mimeType: "image/png", buffer: await png(1400, 900, "#0f5d3a") });
    await page.getByLabel(/may use my submitted contact details/).check();
    page.context().once("page", (p) => p.close().catch(() => {}));
    await page.getByRole("button", { name: "Submit Quotation Request" }).click();
    const ref = (await page.locator("[data-quotation-reference]").textContent())!.trim();
    expect(ref).toMatch(/^PHQ-\d{6}-[A-Z2-9]{5}$/);
    const wa = new URL((await page.locator("[data-quotation-whatsapp]").getAttribute("href"))!);
    expect(wa.origin + wa.pathname).toBe("https://wa.me/94712259699");
    expect(wa.searchParams.get("text")).toContain(ref);

    const list = await (await api.get(`/api/v1/admin/quotations?q=${ref}`)).json();
    expect(list.items).toHaveLength(1);
    const detail = await (await api.get(`/api/v1/admin/quotations/${list.items[0].id}`)).json();
    expect(detail).toMatchObject({
      reference: ref,
      phone: "+94712345678",
      location: town,
      fulfilment: "delivery",
      deliveryAddress: "Isolated test address",
      status: "new",
    });
    expect(detail.items.map((i: { productName: string; quantity: string }) => [i.productName, i.quantity])).toEqual([
      ["Live Test Quote Item", "12.000"],
      ["Live Test Second Item", "3.000"],
    ]);
    expect(detail.photos).toHaveLength(1);
    const photoPath = `/api/v1/admin/quotations/${detail.id}/photos/${detail.photos[0].id}`;
    expect((await api.get(photoPath)).status()).toBe(200);
    expect((await page.request.get(`${API}${photoPath}`)).status()).toBe(401); // never public
  });

  await test.step("Permanent product deletion (admin, confirmed by slug)", async () => {
    const res = await api.delete(`/api/v1/admin/products/${productId}`, { data: { confirmSlug: productSlug } });
    expect(res.status()).toBe(200);
    expect((await api.get(`/api/v1/admin/products/${productId}`)).status()).toBe(404);
  });

  // No layout overflow on this device, and no script/CSP/CORS errors anywhere.
  for (const p of ["/", "/products/", "/about/"]) {
    await page.goto(p);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), p).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});
