import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { API_PORT, BACKEND_DIR, STAFF } from "./stack";

/**
 * Admin end-to-end tests on the isolated stack (throwaway database).
 * Names created here are TEST data in that throwaway database only.
 */
type PgClient = {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
};
type PgModule = { Client: new (o: { connectionString?: string }) => PgClient };
const req = createRequire(path.join(BACKEND_DIR, "package.json"));
const sharp = req("sharp") as (o: { create: { width: number; height: number; channels: 3; background: string } }) => {
  png(): { toBuffer(): Promise<Buffer> };
};
const pg = req("pg") as PgModule;
const AUTH = path.resolve(__dirname, ".auth");
const API = `http://127.0.0.1:${API_PORT}`;

let ipSeq = 0;
// A distinct client address per test, forwarded by the admin server (trusted-proxy mode), so the
// API's per-client rate limits behave as they would for separate staff devices.
test.beforeEach(async ({ page }, info) => {
  ipSeq += 1;
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.${info.project.name === "mobile" ? 21 : 20}.${ipSeq}.1` });
});

async function db<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: process.env.E2E_DB_URL });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

const tag = (p: string) => (p === "mobile" ? "M" : "D");
async function dialog(page: Page) {
  const d = page.locator("dialog[open]");
  await expect(d).toBeVisible();
  return d;
}

test.describe("Access control", () => {
  test("unauthenticated pages redirect to sign-in; the gateway and API reject requests", async ({ page, request }) => {
    await page.goto("/products");
    await expect(page).toHaveURL(/\/login\?next=%2Fproducts$/);
    await expect(page.getByRole("img", { name: "Pathirana Hardware (Pvt) Ltd." })).toBeVisible();
    expect((await request.get("/api/backend/admin/categories")).status()).toBe(401);
    // Mutations need the same-origin CSRF header even before authentication is checked.
    expect((await request.post("/api/backend/admin/categories", { data: { name: "X" } })).status()).toBe(403);
    // Paths outside the staff API are not proxied.
    expect((await request.get("/api/backend/products")).status()).toBe(404);
    expect((await request.get(`${API}/api/v1/admin/categories`)).status()).toBe(401);
  });

  test("sign-in errors, sign-in, sign-out revokes the session", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop", "sign-in rate limits: run once");
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await page.getByLabel("Email").fill(STAFF.session.email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Incorrect email or password");

    await page.getByLabel("Password", { exact: true }).fill(STAFF.session.password);
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(STAFF.session.name)).toBeVisible();

    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "ph_admin_session")!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe("Strict");
    expect(await page.evaluate(() => document.cookie)).not.toContain("ph_admin_session");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login\?signedOut=1$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    // The old token was revoked on the API, not just deleted from the browser.
    const replay = await request.get(`${API}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${session.value}` },
    });
    expect(replay.status()).toBe(401);
  });
});

test.describe("Admin", () => {
  test.use({ storageState: path.join(AUTH, "admin.json") });

  test("dashboard shows real database counts", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome, Test/ })).toBeVisible();
    const [c] = await db<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM products) p, (SELECT count(*)::int FROM products WHERE is_published) pp,
              (SELECT count(*)::int FROM categories) c, (SELECT count(*)::int FROM brands) b,
              (SELECT count(*)::int FROM delivery_areas WHERE is_active AND archived_at IS NULL) d`,
    );
    for (const [label, n] of [
      ["Total Products", c!.p],
      ["Published Products", c!.pp],
      ["Categories", c!.c],
      ["Brands", c!.b],
      ["Active Delivery Areas", c!.d],
    ] as const) {
      await expect(page.locator("li", { hasText: label }).first()).toContainText(String(n));
    }
    await expect(page.getByRole("link", { name: "Add Product" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Delivery Area" })).toBeVisible();
  });

  test("categories: add, edit, search, deactivate, activate", async ({ page }, info) => {
    const name = `Test Category ${tag(info.project.name)}`;
    await page.goto("/categories");
    await page.getByRole("button", { name: "Add Category" }).click();
    let d = await dialog(page);
    await d.getByLabel("Name").fill(name);
    await d.getByLabel("Description").fill("Isolated test data.");
    await d.getByRole("button", { name: "Add Category" }).click();
    await expect(page.getByRole("status")).toContainText(`Category “${name}” added.`);
    const row = page.locator("tr", { hasText: name });
    await expect(row).toContainText("Active");

    // Duplicate name → readable error from the API.
    await page.getByRole("button", { name: "Add Category" }).click();
    d = await dialog(page);
    await d.getByLabel("Name").fill(name.toLowerCase());
    await d.getByRole("button", { name: "Add Category" }).click();
    await expect(d.getByRole("alert")).toContainText("already exists");
    await d.getByRole("button", { name: "Cancel" }).click();

    await row.getByRole("button", { name: `Edit ${name}` }).click();
    d = await dialog(page);
    await d.getByLabel("Display order").fill("5");
    await d.getByRole("button", { name: "Save Changes" }).click();
    await expect(row).toContainText("5");

    await page.getByLabel("Search categories").fill("zzz-none");
    await expect(page.getByText("No matching categories")).toBeVisible();
    await page.getByLabel("Search categories").fill(name);

    await row.getByRole("button", { name: `Deactivate ${name}` }).click();
    d = await dialog(page);
    await expect(d).toContainText("hidden from the public website");
    await d.getByRole("button", { name: "Deactivate" }).click();
    await expect(row).toContainText("Inactive");
    await row.getByRole("button", { name: `Activate ${name}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Activate" }).click();
    await expect(row).toContainText("Active");
    const [audit] = await db<{ n: number }>("SELECT count(*)::int n FROM audit_log WHERE entity_type = 'category'");
    expect(audit!.n).toBeGreaterThanOrEqual(4);
  });

  test("brands: add with the authentic logo, edit, deactivate", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "brand slugs are unique; once is enough");
    await page.goto("/brands");
    await page.getByRole("button", { name: "Add Brand" }).click();
    const d = await dialog(page);
    await d.getByLabel("Name").fill("Würth");
    await d.getByRole("button", { name: "Add Brand" }).click();
    await expect(page.getByRole("status")).toContainText("Brand “Würth” added.");
    const card = page.locator("li", { hasText: "/wurth" });
    const logo = card.getByRole("img", { name: "Würth logo" });
    await expect(logo).toHaveAttribute("src", /\/brands\/wurth\.png/);
    await expect.poll(() => logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);

    await card.getByRole("button", { name: "Edit Würth" }).click();
    const e = await dialog(page);
    await expect(e.getByLabel("Name")).toHaveValue("Würth");
    await e.getByRole("button", { name: "Save Changes" }).click();
    await card.getByRole("button", { name: "Deactivate Würth" }).click();
    await (await dialog(page)).getByRole("button", { name: "Deactivate" }).click();
    await expect(card).toContainText("Inactive");
    await card.getByRole("button", { name: "Activate Würth" }).click();
    await (await dialog(page)).getByRole("button", { name: "Activate" }).click();
    await expect(card).toContainText("Active");
  });

  test("brand logo: upload, replace, remove; the public API follows", async ({ page, request }, info) => {
    const name = `Test Logo Brand ${tag(info.project.name)}`;
    const slug = `test-logo-brand-${tag(info.project.name).toLowerCase()}`;
    const png = await sharp({ create: { width: 300, height: 120, channels: 3, background: "#b8860b" } })
      .png()
      .toBuffer();
    const publicBrand = async () =>
      ((await (await request.get(`${API}/api/v1/brands`)).json()).items as { slug: string; logo: unknown }[]).find(
        (b) => b.slug === slug,
      );

    await page.goto("/brands");
    await page.getByRole("button", { name: "Add Brand" }).click();
    let d = await dialog(page);
    await d.getByLabel("Name").fill(name);
    await d.getByRole("button", { name: "Add Brand" }).click();
    const card = page.locator("li", { hasText: `/${slug}` });
    await expect(card).toContainText("No logo — name shown");
    expect((await publicBrand())?.logo).toBeNull();

    await card.getByRole("button", { name: `Logo for ${name}` }).click();
    d = await dialog(page);
    await expect(d).toContainText("The website shows the brand name instead.");
    await d.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
    await d.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("status")).toContainText(`Logo for “${name}” saved.`);
    await expect(card).toContainText("Uploaded logo");
    const img = card.getByRole("img", { name: `${name} logo` });
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(300);
    const first = (await publicBrand())?.logo as { url: string; width: number };
    expect(first).toMatchObject({ width: 300, height: 120 });
    expect((await request.get(`${API}${first.url}`)).status()).toBe(200);

    // Replace → new public URL, old one gone.
    await card.getByRole("button", { name: `Logo for ${name}` }).click();
    d = await dialog(page);
    await d.locator("input[type=file]").setInputFiles({ name: "logo2.png", mimeType: "image/png", buffer: png });
    await d.getByRole("button", { name: "Replace" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect.poll(async () => ((await publicBrand())?.logo as { url: string }).url).not.toBe(first.url);
    expect((await request.get(`${API}${first.url}`)).status()).toBe(404);

    // Wrong file type is refused before upload.
    await card.getByRole("button", { name: `Logo for ${name}` }).click();
    d = await dialog(page);
    await d
      .locator("input[type=file]")
      .setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await expect(d.getByRole("alert")).toContainText("JPEG, PNG or WebP");

    // Remove → the website falls back to the name.
    await d.getByRole("button", { name: "Remove" }).click();
    await (await dialog(page)).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("status")).toContainText(`Logo for “${name}” removed.`);
    await expect(card).toContainText("No logo — name shown");
    expect((await publicBrand())?.logo).toBeNull();
  });

  test("category image: upload with alt text, edit alt, remove; the public API follows", async ({
    page,
    request,
  }, info) => {
    const name = `Test Image Category ${tag(info.project.name)}`;
    const slug = `test-image-category-${tag(info.project.name).toLowerCase()}`;
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#0f5d3a" } })
      .png()
      .toBuffer();
    const publicCategory = async () =>
      ((await (await request.get(`${API}/api/v1/categories`)).json()).items as { slug: string; image: unknown }[]).find(
        (c) => c.slug === slug,
      );

    await page.goto("/categories");
    await page.getByRole("button", { name: "Add Category" }).click();
    let d = await dialog(page);
    await d.getByLabel("Name").fill(name);
    await d.getByRole("button", { name: "Add Category" }).click();
    await expect(page.getByRole("status")).toContainText(`Category “${name}” added.`);
    const row = page.locator("tr", { hasText: name });
    await expect(row.getByText("No uploaded image")).toBeAttached();
    expect((await publicCategory())?.image).toBeNull();

    await row.getByRole("button", { name: `Image for ${name}` }).click();
    d = await dialog(page);
    await d.locator("input[type=file]").setInputFiles({ name: "cat.png", mimeType: "image/png", buffer: png });
    await d.getByLabel("Alt text").fill("");
    await d.getByRole("button", { name: "Upload" }).click();
    await expect(d.getByRole("alert")).toContainText("alt text");
    await d.getByLabel("Alt text").fill("Test category photo");
    await d.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("status")).toContainText(`Image for “${name}” saved.`);
    await expect(row.getByRole("img", { name: "Test category photo" })).toBeVisible();
    expect(await publicCategory()).toMatchObject({ image: { alt: "Test category photo", width: 1200, height: 800 } });

    await row.getByRole("button", { name: `Image for ${name}` }).click();
    d = await dialog(page);
    await d.getByLabel("Alt text").fill("Edited test photo");
    await d.getByRole("button", { name: "Save Alt Text" }).click();
    await expect(page.getByRole("status")).toContainText(`Image description for “${name}” saved.`);
    expect(await publicCategory()).toMatchObject({ image: { alt: "Edited test photo" } });

    await row.getByRole("button", { name: `Image for ${name}` }).click();
    d = await dialog(page);
    await d.getByRole("button", { name: "Remove" }).click();
    await (await dialog(page)).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("status")).toContainText(`Image for “${name}” removed.`);
    expect((await publicCategory())?.image).toBeNull();
  });

  test("products: create with price/discount, edit, images, publish, filter", async ({ page }, info) => {
    const t = tag(info.project.name);
    const category = `Product Test Category ${t}`;
    const name = `Test Product ${t}`;
    await db("INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
      category,
      `product-test-category-${t.toLowerCase()}`,
    ]);

    await page.goto("/products/new");
    const preview = page.getByTestId("price-preview");
    // Honest default: Contact for Price, no price or discount shown.
    await expect(page.getByLabel("Contact for Price", { exact: true })).toBeChecked();
    await expect(preview).toContainText("Customers see Contact for Price");
    await page.getByLabel("Product name").fill(name);
    await page.getByRole("combobox", { name: /^Category/ }).selectOption({ label: category });
    await page.getByLabel("Short summary").fill("Isolated test product.");
    await page.getByLabel("Unit of sale").fill("bag");
    await page.getByRole("combobox", { name: /^Availability/ }).selectOption("available");

    // Test data only: LKR 2,500.00 with 10% off -> LKR 2,250.00 (calculated by the API).
    await page.getByLabel("Price in LKR", { exact: true }).check();
    const priceInput = page.getByRole("textbox", { name: /^Price \(LKR\)/ });
    await expect(page.getByText("Enter a price in LKR, or choose Contact for Price.")).toBeVisible();
    await priceInput.fill("2500");
    await expect(preview).toContainText("LKR 2,500.00");
    await page.getByRole("combobox", { name: "Discount type" }).selectOption("percentage");
    const discountValue = page.getByRole("textbox", { name: /^Discount value/ });
    await discountValue.fill("150");
    await expect(page.getByText("A percentage discount must be more than 0 and at most 100.").first()).toBeVisible();
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.locator("main [role=alert]").first()).toContainText("Please correct the price");
    await expect(page).toHaveURL(/\/products\/new$/);
    await discountValue.fill("10");
    await page.getByRole("checkbox", { name: /Discount enabled/ }).check();
    await expect(preview).toContainText("− LKR 250.00 (10%)");
    await expect(preview).toContainText("LKR 2,250.00");
    await expect(preview).toContainText("Discount active");
    // A future start date: the offer is scheduled; customers still see the original price.
    await page.getByLabel("Start date").fill("2099-01-01");
    await expect(preview).toContainText("Discount scheduled");
    await expect(preview).toContainText("Customers currently see LKR 2,500.00.");
    await page.getByLabel("Start date").fill("");
    await expect(preview).toContainText("Discount active");
    // A fixed amount above the price is rejected instantly.
    await page.getByRole("combobox", { name: "Discount type" }).selectOption("fixed");
    await page.getByRole("textbox", { name: /^Discount amount/ }).fill("2600");
    await expect(page.getByText("A fixed discount cannot be more than the original price.").first()).toBeVisible();
    await page.getByRole("combobox", { name: "Discount type" }).selectOption("percentage");
    await page.getByRole("textbox", { name: /^Discount value/ }).fill("10");
    await expect(preview).toContainText("LKR 2,250.00");

    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}\/edit\?created=1$/);
    await expect(page.getByRole("status").first()).toContainText("Product created as a draft");
    const [saved] = await db<Record<string, unknown>>(
      `SELECT unit, price_lkr::text AS price, contact_for_price, discount_type, discount_value::text AS dv,
              discount_enabled, availability FROM products WHERE name = $1`,
      [name],
    );
    expect(saved).toEqual({
      unit: "bag",
      price: "2500.00",
      contact_for_price: false,
      discount_type: "percentage",
      dv: "10.00",
      discount_enabled: true,
      availability: "available",
    });
    await expect(page.getByTestId("price-preview")).toContainText("LKR 2,250.00");

    // Invalid file type is rejected in the browser.
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.locator("main [role=alert]")).toContainText("Choose a JPEG, PNG or WebP image.");
    // A disguised file passes the browser check but is rejected by the API's content inspection.
    await input.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not really an image") });
    await page.getByLabel("Alt text").fill("Fake");
    await page.getByRole("button", { name: "Upload Image" }).click();
    await expect(page.locator("main [role=alert]")).toContainText(/valid JPEG, PNG or WebP/);

    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#0f5d3a" } })
      .png()
      .toBuffer();
    await input.setInputFiles({ name: "steel.png", mimeType: "image/png", buffer: png });
    await expect(page.getByRole("img", { name: "Selected image preview" })).toBeVisible();
    await page.getByLabel("Alt text").fill("Test product photo");
    await page.getByRole("button", { name: "Upload Image" }).click();
    const uploaded = page.getByRole("img", { name: "Test product photo" });
    await expect(uploaded).toBeVisible();
    await expect.poll(() => uploaded.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    // The first image is the main image; a second one can replace it as main.
    const imageItem = (alt: string) => page.locator("li", { has: page.getByRole("img", { name: alt, exact: true }) });
    await expect(imageItem("Test product photo")).toContainText("Main");
    await input.setInputFiles({ name: "second.png", mimeType: "image/png", buffer: png });
    await page.getByLabel("Alt text").fill("Test second photo");
    await page.getByRole("checkbox", { name: /Make this the main image/ }).check();
    await page.getByRole("button", { name: "Upload Image" }).click();
    await expect(imageItem("Test second photo")).toContainText("Main");
    await expect(imageItem("Test product photo")).not.toContainText("Main");
    await page.getByRole("button", { name: "Make main image: Test product photo" }).click();
    await expect(imageItem("Test product photo")).toContainText("Main");
    await page.getByRole("button", { name: "Edit alt text: Test second photo" }).click();
    await (await dialog(page)).getByLabel("Alt text").fill("Test second photo edited");
    await (await dialog(page)).getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("img", { name: "Test second photo edited" })).toBeVisible();

    await page.getByRole("checkbox", { name: /^Published/ }).check();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("status").first()).toContainText("Changes saved.");
    const [row] = await db<{ is_published: boolean }>("SELECT is_published FROM products WHERE name = $1", [name]);
    expect(row!.is_published).toBe(true);

    // Removing the main image promotes the remaining one.
    await page.getByRole("button", { name: "Remove image: Test product photo" }).click();
    await (await dialog(page)).getByRole("button", { name: "Remove" }).click();
    await expect(imageItem("Test second photo edited")).toContainText("Main");
    await page.getByRole("button", { name: "Remove image: Test second photo edited" }).click();
    await (await dialog(page)).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(/No images yet/)).toBeVisible();

    await page.goto("/products");
    await page.getByLabel("Status").selectOption("draft");
    await expect(page.getByText(name)).toHaveCount(0);
    await page.getByLabel("Status").selectOption("published");
    const item = page.locator("li", { hasText: name });
    await expect(item).toContainText("Published");
    await expect(item).toContainText("Available");
    await expect(item).toContainText("LKR 2,250.00");
    await expect(item).toContainText("10% off");
    await expect(item).toContainText("per bag");
    await item.getByRole("button", { name: `Unpublish ${name}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("status")).toContainText(`“${name}” unpublished.`);
    await page.getByLabel("Search products").fill("no-such-product-xyz");
    await expect(page.getByText("No matching products")).toBeVisible();
  });

  test("delivery areas: add, edit, deactivate, archive; the public API follows", async ({ page, request }, info) => {
    const name = `Test Delivery Area ${tag(info.project.name)}`;
    await page.goto("/delivery-areas");
    await page.getByRole("button", { name: "Add Delivery Area" }).click();
    let d = await dialog(page);
    await expect(d).toContainText("Enter only locations, fees and notes confirmed by the shop.");
    await d.getByLabel("Area name").fill(name);
    await d.getByLabel("Postal code").pressSequentially("12a3x45");
    await expect(d.getByLabel("Postal code")).toHaveValue("12345");
    await d.getByRole("button", { name: "Add Area" }).click();
    const row = page.locator("tr", { hasText: name });
    await expect(row).toContainText("Not published");
    const check = async () =>
      (await (await request.get(`${API}/api/v1/delivery-areas/check?area=${encodeURIComponent(name)}`)).json()) as {
        supported: boolean;
      };
    expect((await check()).supported).toBe(true);

    await row.getByRole("button", { name: `Edit ${name}` }).click();
    d = await dialog(page);
    await d.getByLabel("Approved delivery fee (LKR)").fill("350");
    await d.getByRole("button", { name: "Save Changes" }).click();
    await expect(row).toContainText("LKR 350");

    await row.getByRole("button", { name: `Deactivate ${name}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Deactivate" }).click();
    await expect(row).toContainText("Inactive");
    expect((await check()).supported).toBe(false);

    await row.getByRole("button", { name: `Archive ${name}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Archive" }).click();
    await expect(page.locator("tr", { hasText: name })).toHaveCount(0);
    await page.getByLabel("Status").selectOption("archived");
    await expect(page.locator("tr", { hasText: name })).toContainText("Archived");
  });

  test("staff: create, change role, reset password, deactivate", async ({ page }, info) => {
    const t = tag(info.project.name);
    const email = `new-staff-${t.toLowerCase()}@test.invalid`;
    const name = `New Staff ${t}`;
    await page.goto("/staff");
    await page.getByRole("button", { name: "Add Staff Member" }).click();
    let d = await dialog(page);
    await d.getByLabel("Full name").fill(name);
    await d.getByLabel("Email").fill(email);
    await d.getByLabel("Temporary password").fill("short");
    await d.getByLabel("Repeat password").fill("short");
    await d.getByRole("button", { name: "Create Account" }).click();
    // Too short: blocked in the browser (the API rule is tested in the backend suite).
    expect(await d.getByLabel("Temporary password").evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page.locator("tr", { hasText: email })).toHaveCount(0);
    await d.getByLabel("Temporary password").fill("Temporary-Staff-Pass-9");
    await d.getByLabel("Repeat password").fill("Temporary-Staff-Pass-9");
    await d.getByRole("button", { name: "Create Account" }).click();
    const row = page.locator("tr", { hasText: email });
    await expect(row).toContainText("Editor");

    await row.getByRole("button", { name: `Role for ${name}` }).click();
    d = await dialog(page);
    await d.getByLabel(`Role for ${name}`).selectOption("admin");
    await d.getByRole("button", { name: "Save Role" }).click();
    await expect(row).toContainText("Admin");

    await row.getByRole("button", { name: `Reset password for ${name}` }).click();
    d = await dialog(page);
    await d.getByLabel("New password").fill("Another-Staff-Pass-8");
    await d.getByLabel("Repeat password").fill("Another-Staff-Pass-8");
    await d.getByRole("button", { name: "Set Password" }).click();
    await expect(page.getByRole("status")).toContainText(`Password reset for ${name}`);

    await row.getByRole("button", { name: `Deactivate ${name}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Deactivate" }).click();
    await expect(row).toContainText("Inactive");
    const [audit] = await db<{ text: string }>("SELECT string_agg(details::text, ' ') AS text FROM audit_log");
    expect(audit!.text ?? "").not.toContain("Another-Staff-Pass-8");
    // Own account: no role / deactivate controls.
    await expect(page.locator("tr", { hasText: STAFF.admin.email })).toContainText("Change your password in Settings");
  });
});

test.describe("Editor", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("cannot manage staff (UI and API), can manage the catalogue", async ({ page, request }) => {
    await page.goto("/dashboard");
    if (await page.getByRole("button", { name: "Open menu" }).isVisible())
      await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Staff" })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Categories" }),
    ).toBeVisible();
    await page.goto("/staff");
    await expect(page.getByRole("heading", { name: "Administrators only" })).toBeVisible();
    const cookie = (await page.context().cookies()).find((c) => c.name === "ph_admin_session")!.value;
    const res = await request.get("/api/backend/admin/staff", { headers: { Cookie: `ph_admin_session=${cookie}` } });
    expect(res.status()).toBe(403);
    await page.goto("/categories");
    await expect(page.getByRole("button", { name: "Add Category" })).toBeVisible();
  });
});

/** A customer's request through the PUBLIC API (as the website sends it). TEST data only. */
async function submitQuotation(
  request: import("@playwright/test").APIRequestContext,
  name: string,
  ip: string,
  photo?: Buffer,
) {
  const res = await request.post(`${API}/api/v1/quotations`, {
    headers: { "X-Forwarded-For": ip },
    multipart: {
      data: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        customerName: name,
        phone: "0712345678",
        location: "Other",
        otherLocation: "Test Town",
        fulfilment: "delivery",
        deliveryAddress: "Test address",
        notes: "Test notes",
        contactConsent: true,
        items: [
          { productName: "Test Cement", quantity: "10", unit: "bag" },
          { productName: "Test Sheets", quantity: "2.5", unit: "sheet" },
        ],
      }),
      ...(photo ? { photos: { name: "p.png", mimeType: "image/png", buffer: photo } } : {}),
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { reference: string };
}

async function apiToken(request: import("@playwright/test").APIRequestContext, who: "admin" | "editor", ip: string) {
  const res = await request.post(`${API}/api/v1/auth/login`, {
    headers: { "X-Forwarded-For": ip },
    data: { email: STAFF[who].email, password: STAFF[who].password },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

test.describe("Quotation requests (editor)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("list, search, filter, detail with private photos, status, contact actions", async ({ page, request }, info) => {
    const name = `Test Quote Customer ${tag(info.project.name)}`;
    const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#b8860b" } })
      .png()
      .toBuffer();
    const { reference } = await submitQuotation(
      request,
      name,
      `10.30.${info.project.name === "mobile" ? 2 : 1}.1`,
      photo,
    );

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /New Quotation Requests/ })).toBeVisible();
    await page.goto("/quotations");
    await expect(page.getByRole("heading", { name: "Quotation Requests" })).toBeVisible();
    await page.getByLabel("Search quotation requests").fill(reference);
    const row = page.locator("li", { hasText: reference });
    await expect(row).toContainText(name);
    await expect(row).toContainText("2 items");
    await expect(row).toContainText("New");
    await row.getByRole("link", { name: reference }).click();

    const detail = page.locator(`[data-quotation='${reference}']`);
    await expect(detail).toContainText("+94712345678");
    await expect(detail).toContainText("Test Town (Other — typed by the customer)");
    await expect(detail).toContainText("Test address");
    await expect(detail).toContainText("1. Test Cement");
    await expect(detail).toContainText("10 bag");
    await expect(detail).toContainText("2.5 sheet");
    const img = detail.getByRole("img", { name: "Customer reference photo 1" });
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
    // Photos are never public: the API refuses without a staff session.
    const src = (await img.getAttribute("src"))!;
    const apiPath = src.replace("/api/backend/", "/api/v1/");
    expect((await request.get(`${API}${apiPath}`)).status()).toBe(401);
    await expect(detail.getByRole("link", { name: "WhatsApp customer" })).toHaveAttribute(
      "href",
      new RegExp(`^https://wa\\.me/94712345678\\?text=.*${reference}`),
    );
    await expect(detail.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+94712345678");

    await page.getByLabel("Status").selectOption("in_review");
    await page.getByRole("button", { name: "Save Status" }).click();
    await expect(page.getByRole("status")).toContainText("Status changed to In Review.");
    await page.goto("/quotations?status=in_review");
    await expect(page.locator("li", { hasText: reference })).toContainText("In Review");
  });
});

test.describe("Permanent product deletion", () => {
  test("admins only, confirmed by the slug; unpublish stays the routine action", async ({ browser, request }, info) => {
    test.skip(info.project.name !== "desktop", "creates a uniquely named product once");
    const ip = "10.31.0.1";
    const token = await apiToken(request, "admin", ip);
    const auth = { Authorization: `Bearer ${token}`, "X-Forwarded-For": ip };
    const cat = await request.post(`${API}/api/v1/admin/categories`, {
      headers: auth,
      data: { name: "Test Delete Cat" },
    });
    const product = await request.post(`${API}/api/v1/admin/products`, {
      headers: auth,
      data: {
        name: "Test Delete Me",
        categoryId: (await cat.json()).id,
        contactForPrice: true,
        discountType: "none",
        discountEnabled: false,
        availability: "on_request",
      },
    });
    const id = ((await product.json()) as { id: string }).id;

    // Editors see no delete option.
    const editorCtx = await browser.newContext({ storageState: path.join(AUTH, "editor.json") });
    const editorPage = await editorCtx.newPage();
    await editorPage.goto(`/products/${id}/edit`);
    await expect(editorPage.getByRole("heading", { name: "Edit Product" })).toBeVisible();
    await expect(editorPage.getByRole("button", { name: "Delete product…" })).toHaveCount(0);
    await editorCtx.close();

    const adminCtx = await browser.newContext({ storageState: path.join(AUTH, "admin.json") });
    const page = await adminCtx.newPage();
    await page.goto(`/products/${id}/edit`);
    await page.getByRole("button", { name: "Delete product…" }).click();
    const d = await dialog(page);
    await expect(d.getByRole("button", { name: "Delete Permanently" })).toBeDisabled();
    await d.getByRole("textbox").fill("wrong-slug");
    await expect(d.getByRole("button", { name: "Delete Permanently" })).toBeDisabled();
    await d.getByRole("textbox").fill("test-delete-me");
    await d.getByRole("button", { name: "Delete Permanently" }).click();
    await expect(page).toHaveURL(/\/products\?deleted=/);
    await expect(page.getByRole("status")).toContainText("“Test Delete Me” was deleted permanently.");
    expect((await request.get(`${API}/api/v1/admin/products/${id}`, { headers: auth })).status()).toBe(404);
    await adminCtx.close();
  });
});

test.describe("Responsive", () => {
  test.use({ storageState: path.join(AUTH, "admin.json") });

  test("no page-wide horizontal overflow at 320–1440 px; navigation works", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "viewports set explicitly");
    test.setTimeout(240_000);
    const routes = [
      "/dashboard",
      "/products",
      "/products/new",
      "/categories",
      "/brands",
      "/delivery-areas",
      "/quotations",
      "/staff",
      "/settings",
    ];
    for (const width of [320, 360, 390, 430, 768, 820, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const r of routes) {
        await page.goto(r);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const { overflow, culprits } = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const wide = [...document.querySelectorAll("body *")]
            .filter((el) => {
              if (el.getBoundingClientRect().right <= vw + 1) return false;
              // Ignore content inside its own scroll/clip container (e.g. a wide table that scrolls).
              for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
                const o = getComputedStyle(p).overflowX;
                if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return false;
              }
              return true;
            })
            .slice(0, 4)
            .map(
              (el) =>
                `${el.tagName}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}`,
            );
          return { overflow: document.documentElement.scrollWidth - vw, culprits: wide };
        });
        expect(overflow, `${r} at ${width}px: ${culprits.join(" | ")}`).toBeLessThanOrEqual(0);
      }
      // Phones/tablets: drawer; desktop: sidebar.
      if (width < 1024) {
        await page.getByRole("button", { name: "Open menu" }).click();
        const drawer = page.getByRole("dialog", { name: "Menu" });
        await expect(drawer.getByRole("img", { name: "Pathirana Hardware (Pvt) Ltd." })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
      } else {
        await expect(page.locator("aside").getByRole("img", { name: "Pathirana Hardware (Pvt) Ltd." })).toBeVisible();
      }
      if ([320, 390, 768, 1440].includes(width)) {
        await page.goto("/products");
        await page.screenshot({ path: `D:/.tmp/pathirana-screens/admin/products-${width}.png`, fullPage: true });
        await page.goto("/dashboard");
        await page.screenshot({ path: `D:/.tmp/pathirana-screens/admin/dashboard-${width}.png`, fullPage: true });
      }
    }
    await page.context().clearCookies();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/login");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `D:/.tmp/pathirana-screens/admin/login-${width}.png` });
    }
  });
});
