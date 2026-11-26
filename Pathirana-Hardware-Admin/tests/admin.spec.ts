import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { API_PORT, BACKEND_DIR, STAFF, WEBSITE_URL } from "./stack";

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
    await expect(page.getByRole("img", { name: "Pathirana Hardware logo", exact: true })).toBeVisible();
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
    // Validation timing: nothing on the untouched form; errors on leaving a field or on Sign In.
    await expect(page.getByText("Enter an email address.")).toHaveCount(0);
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password *", { exact: true }).focus();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await page.getByLabel("Email").fill("");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Enter an email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeFocused(); // first invalid field
    await page.getByLabel("Email").fill(STAFF.session.email);
    await expect(page.getByText("Enter an email address.")).toHaveCount(0); // re-checked as typed
    await page.getByLabel("Password *", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Incorrect email or password");

    await page.getByLabel("Password *", { exact: true }).fill(STAFF.session.password);
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password *", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("button", { name: `${STAFF.session.name} Editor` })).toBeVisible();

    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "ph_admin_session")!;
    expect(session.httpOnly).toBe(true);
    expect(session.sameSite).toBe("Strict");
    expect(await page.evaluate(() => document.cookie)).not.toContain("ph_admin_session");

    // Account menu → Sign out → confirm.
    await page.getByRole("button", { name: `${STAFF.session.name} Editor` }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await (await dialog(page)).getByRole("button", { name: "Sign Out" }).click();
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
    await expect(page.getByRole("heading", { name: "Pathirana Hardware Admin" })).toBeVisible();
    await expect(page.getByText("Welcome back")).toBeVisible();
    const [c] = await db<Record<string, number>>(
      `SELECT (SELECT count(*)::int FROM products) p, (SELECT count(*)::int FROM products WHERE is_published) pp,
              (SELECT count(*)::int FROM categories) c, (SELECT count(*)::int FROM brands) b,
              (SELECT count(*)::int FROM delivery_areas WHERE is_active AND archived_at IS NULL) d`,
    );
    for (const [label, n] of [
      ["Published Products", c!.pp],
      ["Categories", c!.c],
      ["Brands", c!.b],
      ["Active Delivery Areas", c!.d],
    ] as const) {
      await expect(page.locator("li", { hasText: label }).first()).toContainText(String(n));
    }
    await expect(page.getByRole("link", { name: "Add Product" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage Delivery Areas" })).toBeVisible();
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
    // Says WHAT is duplicated (audit ADM-2), not just "already exists".
    await expect(d.getByRole("alert")).toContainText(/A category with this name( or URL slug)? already exists\./);
    await d.getByRole("button", { name: "Cancel" }).click();

    await row.getByRole("button", { name: `Edit ${name}` }).click();
    d = await dialog(page);
    // Display order: whole numbers 0+ only — signs, decimals and letters cannot be entered.
    const order = d.getByLabel("Display order");
    await order.fill("");
    await order.pressSequentially("-1.5e");
    await expect(order).toHaveValue("15");
    await order.fill("");
    await order.blur();
    await expect(d.getByText("Display order must be a whole number (0 or more).")).toBeVisible();
    await order.fill("5");
    await d.getByRole("button", { name: "Save Changes" }).click();
    await expect(row).toContainText("5");
    // The API refuses a negative order even when the browser is bypassed.
    const cookie = (await page.context().cookies()).find((c) => c.name === "ph_admin_session")!.value;
    const [cat] = await db<{ id: string }>("SELECT id FROM categories WHERE name = $1", [name]);
    const neg = await page.request.patch(`/api/backend/admin/categories/${cat!.id}`, {
      headers: { Cookie: `ph_admin_session=${cookie}`, "x-ph-admin": "1", Origin: new URL(page.url()).origin },
      data: { sortOrder: -1 },
    });
    expect(neg.status()).toBe(400);
    expect(await neg.text()).toContain("Display order must be a whole number (0 or more).");

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
    // Contact for Price: the LKR price cannot be typed and nothing suggests "LKR 0".
    await expect(page.getByRole("textbox", { name: /^Price \(LKR\)/ })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: /^Price \(LKR\)/ })).toHaveValue("");
    await expect(preview).not.toContainText("LKR 0");
    // Untouched form: no errors until a field is left or Create is pressed.
    await expect(page.getByText("Enter the product name.")).toHaveCount(0);
    await page.getByLabel("Product name").fill(name);
    await page.getByRole("combobox", { name: /^Category/ }).selectOption({ label: category });
    await page.getByLabel("Short summary").fill("Isolated test product.");
    await page.getByLabel("Unit of sale").fill("bag");
    await page.getByRole("combobox", { name: /^Availability/ }).selectOption("available");

    // Test data only: LKR 2,500.00 with 10% off -> LKR 2,250.00 (calculated by the API).
    await page.getByLabel("Price in LKR", { exact: true }).check();
    const priceInput = page.getByRole("textbox", { name: /^Price \(LKR\)/ });
    await expect(priceInput).toBeEnabled();
    // The error waits until the field is left empty.
    await expect(page.getByText("Enter a price in LKR, or choose Contact for Price.")).toHaveCount(0);
    await priceInput.focus();
    await priceInput.blur();
    await expect(page.getByText("Enter a price in LKR, or choose Contact for Price.")).toBeVisible();
    await priceInput.fill("2500");
    await expect(preview).toContainText("LKR 2,500.00");
    await page.getByRole("combobox", { name: "Discount type" }).selectOption("percentage");
    const discountValue = page.getByRole("textbox", { name: /^Discount value/ });
    await discountValue.fill("150");
    await discountValue.blur();
    await expect(page.getByText("A percentage discount must be more than 0 and at most 100.").first()).toBeVisible();
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.locator("main [role=alert]").first()).toContainText("Please correct the highlighted fields.");
    await expect(discountValue).toBeFocused(); // the first invalid field
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
    // Back to the Products list with a confirmation (requirement 24), then open it to add images.
    await expect(page).toHaveURL(/\/products\?created=/);
    await expect(page.getByRole("status").first()).toContainText(
      `Product “${name}” added successfully. It is listed below.`,
    );
    await page
      .getByRole("link", { name: `Edit ${name}` })
      .first()
      .click();
    await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}\/edit$/);
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
    // Save Changes → back to the Products list, which confirms the save.
    const editUrl = page.url();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page).toHaveURL(/\/products\?saved=/);
    await expect(page.getByRole("status").first()).toContainText(`Product changes to “${name}” saved successfully.`);
    const [row] = await db<{ is_published: boolean }>("SELECT is_published FROM products WHERE name = $1", [name]);
    expect(row!.is_published).toBe(true);
    await page.goto(editUrl);

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
    const item = page.locator("[data-product-row]", { hasText: name });
    await expect(item).toContainText("Published");
    await expect(item).toContainText("Available");
    await expect(item).toContainText("LKR 2,250.00");
    await expect(item).toContainText("10% off");
    await expect(item).toContainText("per bag");
    await item.getByRole("button", { name: `Unpublish ${name}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("status")).toContainText(`“${name}” unpublished.`);
    await page.locator("main").getByLabel("Search products").fill("no-such-product-xyz");
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
    const archivedId = (await db<{ id: string }>("SELECT id FROM delivery_areas WHERE name = $1", [name]))[0]!.id;

    // Restore (admins): the SAME record comes back, active, and the public API follows.
    await page
      .locator("tr", { hasText: name })
      .getByRole("button", { name: `Restore ${name}` })
      .click();
    await (await dialog(page)).getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("status")).toContainText(`“${name}” restored and active again.`);
    await page.getByLabel("Status").selectOption("active");
    await expect(page.locator("tr", { hasText: name })).toContainText("Active");
    expect((await check()).supported).toBe(true);
    expect(await db<{ id: string }>("SELECT id FROM delivery_areas WHERE name = $1", [name])).toEqual([
      { id: archivedId },
    ]);
    const [restoreAudit] = await db<{ n: string }>(
      "SELECT count(*) AS n FROM audit_log WHERE action = 'delivery-area.restore' AND entity_id = $1",
      [archivedId],
    );
    expect(Number(restoreAudit!.n)).toBe(1);
  });

  test("staff: add without a password, one-time set-up link, edit, role, reset link, deactivate", async ({
    page,
    browser,
  }, info) => {
    const t = tag(info.project.name);
    const email = `new-staff-${t.toLowerCase()}@test.invalid`;
    const name = `New Staff ${t}`;
    await page.goto("/staff");
    await page.getByRole("button", { name: "Add Staff" }).click();
    let d = await dialog(page);
    // No password field: the person chooses their own through the one-time link.
    await expect(d.getByLabel(/password/i)).toHaveCount(0);
    await d.getByRole("button", { name: "Create Account" }).click();
    await expect(d.getByText("Enter the full name.")).toBeVisible();
    await d.getByLabel("Full name").fill(name);
    await d.getByLabel("Email address").fill("not-an-email");
    await d.getByLabel("Email address").blur();
    await expect(d.getByText("Enter a valid email address.")).toBeVisible();
    await d.getByLabel("Email address").fill(email);
    await d.getByRole("button", { name: "Create Account" }).click();

    // The link is shown once; only its hash is stored.
    d = await dialog(page);
    await expect(d).toContainText("One-time password link");
    const url = (await d.locator("[data-password-link] .font-mono").innerText()).trim();
    expect(url).toMatch(/\/setup-password\?token=[A-Za-z0-9_-]{43}$/);
    const token = new URL(url).searchParams.get("token")!;
    const [stored] = await db<{ token_hash: string }>(
      "SELECT t.token_hash FROM staff_password_tokens t JOIN staff s ON s.id = t.staff_id WHERE s.email = $1",
      [email],
    );
    expect(stored!.token_hash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
    await d.getByRole("button", { name: "Done" }).click();
    const row = page.locator(`tr[data-staff='${email}']`);
    await expect(row).toContainText("Editor");
    await expect(row).toContainText("Link not used yet");

    // The new person opens the link (no session) and chooses a password.
    const anon = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": `10.40.${t === "M" ? 2 : 1}.1` } });
    const p2 = await anon.newPage();
    await p2.goto(url);
    await expect(p2.locator("[data-setup-state='form']")).toContainText(name);
    await p2.getByLabel("New password").fill("short");
    await p2.getByLabel("New password").blur();
    await expect(p2.getByText("Use at least 12 characters.")).toBeVisible();
    await p2.getByLabel("New password").fill("Chosen-Staff-Pass-77");
    await p2.getByLabel("Repeat password").fill("Chosen-Staff-Pass-77");
    await p2.getByRole("button", { name: "Save Password" }).click();
    await expect(p2.locator("[data-setup-state='done']")).toBeVisible();
    // Used once: the same link no longer works.
    await p2.goto(url);
    await expect(p2.locator("[data-setup-state='invalid']")).toContainText("expired or has already been used");
    await anon.close();
    await page.reload();
    await expect(row).not.toContainText("Link not used yet");

    await row.getByRole("button", { name: `Edit ${name}` }).click();
    d = await dialog(page);
    await d.getByLabel("Full name").fill(`${name} Edited`);
    await d.getByRole("button", { name: "Save Details" }).click();
    await expect(page.getByRole("status")).toContainText(`Details saved for ${name} Edited.`);
    const edited = `${name} Edited`;

    await row.getByRole("button", { name: `Role for ${edited}` }).click();
    d = await dialog(page);
    await d.getByLabel(`Role for ${edited}`).selectOption("admin");
    await d.getByRole("button", { name: "Save Role" }).click();
    await expect(row).toContainText("Admin");

    await row.getByRole("button", { name: new RegExp(`link for ${edited}`) }).click();
    await (await dialog(page)).getByRole("button", { name: "Create Link" }).click();
    await expect(page.getByRole("dialog", { name: "One-time password link" })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    await row.getByRole("button", { name: `Deactivate ${edited}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Deactivate" }).click();
    await expect(row).toContainText("Deactivated");
    await row.getByRole("button", { name: `Reactivate ${edited}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Reactivate" }).click();
    await expect(row).toContainText("Active");

    // Nothing secret reaches the audit log.
    const [audit] = await db<{ text: string }>("SELECT string_agg(details::text, ' ') AS text FROM audit_log");
    expect(audit!.text ?? "").not.toContain("Chosen-Staff-Pass-77");
    expect(audit!.text ?? "").not.toContain(token);
    // Own account: no role / link / deactivate controls (an admin cannot lock themself out).
    const mine = page.locator(`tr[data-staff='${STAFF.admin.email}']`);
    await expect(mine).toContainText("(you)");
    await expect(mine.getByRole("button", { name: /Role for|Deactivate/ })).toHaveCount(0);
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
    // A clear View Details action on every request (the reference is a link too).
    await expect(row.getByRole("link", { name: reference, exact: true })).toHaveAttribute(
      "href",
      /\/quotations\/[0-9a-f-]{36}$/,
    );
    await row.getByRole("link", { name: `View Details of ${reference}` }).click();
    await expect(page).toHaveURL(/\/quotations\/[0-9a-f-]{36}$/);

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
    // Larger preview with download, still through the staff-only gateway.
    await detail.getByRole("button", { name: /Customer reference photo 1/ }).click();
    const viewer = await dialog(page);
    await expect(viewer).toContainText(`${reference} — photo 1 of 1`);
    const big = viewer.getByRole("img", { name: "Customer reference photo 1" });
    await expect.poll(() => big.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(900);
    const download = viewer.getByRole("link", { name: "Download" });
    await expect(download).toHaveAttribute("download", `${reference}-photo-1.webp`);
    expect(await download.getAttribute("href")).toMatch(
      /^\/api\/backend\/admin\/quotations\/[0-9a-f-]+\/photos\/[0-9a-f-]+$/,
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    // Reply via WhatsApp: an editable draft to the CUSTOMER with the reference; nothing is sent automatically.
    const reply = detail.getByRole("link", { name: "Reply via WhatsApp" });
    const replyHref = (await reply.getAttribute("href"))!;
    expect(replyHref.startsWith("https://wa.me/94712345678?text=")).toBe(true);
    expect(new URL(replyHref).searchParams.get("text")).toBe(
      [
        `Hello ${name},`,
        "",
        `Regarding your quotation request ${reference}, we have reviewed your requirements.`,
        "",
        "[Staff enters confirmed quotation details]",
        "",
        "Thank you,",
        "Pathirana Hardware",
      ].join("\n"),
    );
    await expect(reply).toHaveAttribute("target", "_blank");
    await expect(detail.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+94712345678");
    // Opening the reply link does not change the status.
    const [before] = await db<{ status: string }>("SELECT status FROM quotation_requests WHERE reference = $1", [
      reference,
    ]);
    expect(before!.status).toBe("new");

    await page.getByLabel("Status").selectOption("in_review");
    await page.getByRole("button", { name: "Save Status" }).click();
    await expect(page.getByRole("status")).toContainText("Status changed to In Review.");
    await page.goto("/quotations?status=in_review");
    await expect(page.locator("li", { hasText: reference })).toContainText("In Review");
  });
});

test.describe("Services (editor)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("edit an approved service, validation, image, hide/publish; the public API follows", async ({
    page,
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop", "edits a shared seeded service; once is enough");
    const publicList = async () =>
      (await (await request.get(`${API}/api/v1/services`)).json()).items as {
        slug: string;
        summary: string;
        image: { url: string } | null;
      }[];
    // The six approved services are seeded by migration 0008 (nothing invented); test- services are other tests'.
    expect((await publicList()).map((s) => s.slug).filter((s) => !s.startsWith("test-"))).toEqual([
      "building-material-supply",
      "home-site-delivery",
      "bulk-orders",
      "product-reservations",
      "product-advice",
      "contractor-support",
    ]);

    await page.goto("/services");
    await expect(page.locator("tr[data-service]")).toHaveCount(6);
    await page.getByLabel("Search services").fill("delivery");
    const row = page.locator("tr[data-service='home-site-delivery']");
    await expect(row).toBeVisible();
    const title = (await row.locator("td").nth(1).locator("p").first().innerText()).trim();

    await row.getByRole("button", { name: `Edit ${title}` }).click();
    let d = await dialog(page);
    const summary = d.getByLabel("Summary");
    const original = await summary.inputValue();
    await summary.fill("");
    await summary.blur();
    await expect(d.locator("[aria-invalid='true']")).toHaveCount(1);
    await summary.fill("Test summary edited in the isolated database.");
    await expect(d.locator("[aria-invalid='true']")).toHaveCount(0);
    await d.getByRole("button", { name: "Save Service" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect
      .poll(async () => (await publicList()).find((s) => s.slug === "home-site-delivery")?.summary)
      .toBe("Test summary edited in the isolated database.");

    // Image: upload → public URL; remove → back to the 3D illustration.
    const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#0f5d3a" } })
      .png()
      .toBuffer();
    await row.getByRole("button", { name: `Image for ${title}` }).click();
    d = await dialog(page);
    await d.locator("input[type=file]").setInputFiles({ name: "svc.png", mimeType: "image/png", buffer: png });
    await d.getByLabel("Alt text").fill("Test delivery photo");
    await d.getByRole("button", { name: "Upload" }).click();
    await expect(row.getByRole("img", { name: "Test delivery photo" })).toBeVisible();
    const img = (await publicList()).find((s) => s.slug === "home-site-delivery")!.image!;
    expect((await request.get(`${API}${img.url}`)).status()).toBe(200);

    // Hide → gone from the website list and its image is no longer public. Publish → back.
    await row.getByRole("button", { name: `Hide ${title}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Hide" }).click();
    await expect(row).toContainText("Hidden");
    expect((await publicList()).map((s) => s.slug)).not.toContain("home-site-delivery");
    expect((await request.get(`${API}${img.url}`)).status()).toBe(404);
    await row.getByRole("button", { name: `Publish ${title}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Publish" }).click();
    await expect(row).toContainText("Published");

    await row.getByRole("button", { name: `Image for ${title}` }).click();
    d = await dialog(page);
    await d.getByRole("button", { name: "Remove" }).click();
    await (await dialog(page)).getByRole("button", { name: "Remove" }).click();
    await expect.poll(async () => (await publicList()).find((s) => s.slug === "home-site-delivery")?.image).toBeNull();

    // Restore the seeded wording (test hygiene).
    await row.getByRole("button", { name: `Edit ${title}` }).click();
    d = await dialog(page);
    await d.getByLabel("Summary").fill(original);
    await d.getByRole("button", { name: "Save Service" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    const [audit] = await db<{ n: number }>("SELECT count(*)::int n FROM audit_log WHERE entity_type = 'service'");
    expect(audit!.n).toBeGreaterThanOrEqual(5);
  });

  test("add a new service with an image: See More only, no 3D scene; the public API follows", async ({
    page,
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop", "adds a published service to the shared list; once is enough");
    const t = tag(info.project.name);
    const name = `Test Service ${t} Tool Hire`;
    const slug = `test-service-${t.toLowerCase()}-tool-hire`;
    const publicList = async () =>
      (await (await request.get(`${API}/api/v1/services`)).json()).items as {
        slug: string;
        image: { url: string; alt: string } | null;
      }[];

    await page.goto("/services");
    // The six approved services are marked as keeping their 3D scenes.
    await expect(
      page.locator("tr[data-service='bulk-orders']").getByText("3D scene + See More", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add Service" }).click();
    let d = await dialog(page);
    await expect(d.locator("[data-service-placement]")).toContainText("New services do not get a 3D scene.");
    await d.getByRole("textbox", { name: "Title *", exact: true }).fill(name);
    await d.getByRole("textbox", { name: "Summary *", exact: true }).fill("Test summary for a new service.");
    await d.getByRole("textbox", { name: "Description *", exact: true }).fill("Test description for a new service.");
    await d.getByRole("textbox", { name: "Display order *", exact: true }).fill("900");
    await d.getByRole("button", { name: "Save Service" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    // Hidden until published.
    const row = page.locator(`tr[data-service='${slug}']`);
    await expect(row).toContainText("Hidden");
    await expect(row.getByText("See More page", { exact: true })).toBeVisible();
    expect((await publicList()).map((s) => s.slug)).not.toContain(slug);

    // Image, then publish: listed last (display order 900) with its image.
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#b8860b" } })
      .png()
      .toBuffer();
    await row.getByRole("button", { name: `Image for ${name}` }).click();
    d = await dialog(page);
    await d.locator("input[type=file]").setInputFiles({ name: "new.png", mimeType: "image/png", buffer: png });
    await d.getByLabel("Alt text").fill("Test tool hire photo");
    await d.getByRole("button", { name: "Upload" }).click();
    await expect(row.getByRole("img", { name: "Test tool hire photo" })).toBeVisible();
    await page.keyboard.press("Escape");
    await row.getByRole("button", { name: `Publish ${name}` }).click();
    await (await dialog(page)).getByRole("button", { name: "Publish" }).click();
    await expect(row).toContainText("Published");

    const listed = await publicList();
    expect(listed.at(-1)?.slug).toBe(slug);
    expect(listed.at(-1)?.image?.alt).toBe("Test tool hire photo");
    expect((await request.get(`${API}${listed.at(-1)!.image!.url}`)).status()).toBe(200);
    // The six approved services are unchanged in order.
    expect(listed.slice(0, 6).map((s) => s.slug)).toEqual([
      "building-material-supply",
      "home-site-delivery",
      "bulk-orders",
      "product-reservations",
      "product-advice",
      "contractor-support",
    ]);
  });
});

test.describe("Gallery (editor)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("upload several photos (hidden), edit, publish, delete; the public API follows", async ({
    page,
    request,
  }, info) => {
    const t = tag(info.project.name);
    const png = (bg: string) =>
      sharp({ create: { width: 1200, height: 900, channels: 3, background: bg } })
        .png()
        .toBuffer();
    const publicTitles = async () =>
      ((await (await request.get(`${API}/api/v1/gallery`)).json()).items as { title: string }[])
        .map((g) => g.title)
        .filter((x) => x.startsWith(`Test Photo ${t}`));

    await page.goto("/gallery");
    await page.getByRole("button", { name: "Upload Photos" }).click();
    const d = await dialog(page);
    await d.locator("input[type=file]").setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: await png("#0f5d3a") },
      { name: "b.png", mimeType: "image/png", buffer: await png("#b8860b") },
    ]);
    await expect(d.getByRole("img", { name: /Selected photo/ })).toHaveCount(2);
    await d.getByLabel("Group (optional)").fill(`Test Group ${t}`);
    const titles = d.getByLabel("Title");
    const alts = d.getByLabel("Description (alt text)");
    await titles.nth(0).fill(`Test Photo ${t} One`);
    await titles.nth(1).fill(`Test Photo ${t} Two`);
    await alts.nth(0).fill("Test green photo");
    await alts.nth(1).fill("Test gold photo");
    await d.getByRole("button", { name: /Upload 2 Photos/ }).click();
    await expect(page.getByRole("status")).toContainText("2 photos uploaded (hidden until you publish them).");
    // Uploaded photos start hidden: not listed publicly and their files are not public.
    expect(await publicTitles()).toEqual([]);
    const [one] = await db<{ id: string }>("SELECT id FROM gallery_photos WHERE title = $1", [`Test Photo ${t} One`]);
    expect((await request.get(`${API}/api/v1/gallery-images/${one!.id}`)).status()).toBe(404);

    const card = page.locator("li", { hasText: `Test Photo ${t} One` });
    await card.getByRole("button", { name: `Publish Test Photo ${t} One` }).click();
    await (await dialog(page)).getByRole("button", { name: "Publish" }).click();
    await expect(card).toContainText("Published");
    await expect.poll(publicTitles).toEqual([`Test Photo ${t} One`]);
    expect((await request.get(`${API}/api/v1/gallery-images/${one!.id}?size=thumb`)).status()).toBe(200);

    // Edit with validation timing and a whole-number display order.
    await card.getByRole("button", { name: `Edit Test Photo ${t} One` }).click();
    let e = await dialog(page);
    await e.getByLabel("Title").fill("");
    await e.getByLabel("Title").blur();
    await expect(e.locator("[aria-invalid='true']")).toHaveCount(1);
    await e.getByLabel("Title").fill(`Test Photo ${t} One`);
    await e.getByLabel("Caption (optional)").fill("Test caption");
    await e.getByLabel("Display order").fill("");
    await e.getByLabel("Display order").pressSequentially("-3");
    await expect(e.getByLabel("Display order")).toHaveValue("3");
    await e.getByRole("button", { name: /Save/ }).click();
    await expect(page.getByRole("status")).toContainText(`“Test Photo ${t} One” saved.`);

    // Delete (confirmed) removes the record and the public file.
    await card.getByRole("button", { name: `Delete Test Photo ${t} One` }).click();
    e = await dialog(page);
    await e.getByRole("button", { name: "Delete Photo" }).click();
    await expect(page.locator("li", { hasText: `Test Photo ${t} One` })).toHaveCount(0);
    expect(await db("SELECT id FROM gallery_photos WHERE id = $1", [one!.id])).toEqual([]);
    expect((await request.get(`${API}/api/v1/gallery-images/${one!.id}`)).status()).toBe(404);
  });
});

test.describe("Retired quotation emails", () => {
  test.use({ storageState: path.join(AUTH, "admin.json") });

  test("no Settings section, no endpoint, and new requests queue no email", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop", "once is enough");
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Change password" })).toBeVisible();
    await expect(page.getByText("Quotation Notifications")).toHaveCount(0);
    const token = await apiToken(request, "admin", "10.32.0.1");
    expect(
      (
        await request.get(`${API}/api/v1/admin/settings/quotation-notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status(),
    ).toBe(404);
    const { reference } = await submitQuotation(request, "Test No Email Customer", "10.32.0.2");
    const queued = await db(
      `SELECT n.id FROM quotation_notifications n JOIN quotation_requests r ON r.id = n.quotation_id
        WHERE r.reference = $1`,
      [reference],
    );
    expect(queued).toEqual([]);
  });
});

test.describe("Permissions (editor)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("editors manage services and gallery; the API refuses them staff links and area restores", async ({
    page,
    request,
  }) => {
    await page.goto("/dashboard");
    if (await page.getByRole("button", { name: "Open menu" }).isVisible())
      await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Services" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Gallery" })).toBeVisible();
    const token = await apiToken(request, "editor", "10.33.0.1");
    const bearer = { Authorization: `Bearer ${token}` };
    const [admin] = await db<{ id: string }>("SELECT id FROM staff WHERE email = $1", [STAFF.admin.email]);
    expect(
      (
        await request.post(`${API}/api/v1/admin/staff/${admin!.id}/password-link`, {
          headers: bearer,
          data: { purpose: "reset" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post(`${API}/api/v1/admin/delivery-areas/${crypto.randomUUID()}/restore`, {
          headers: bearer,
          data: {},
        })
      ).status(),
    ).toBe(403);
    // Anonymous visitors cannot reach the staff services / gallery API.
    expect((await request.get(`${API}/api/v1/admin/services`)).status()).toBe(401);
    expect((await request.get(`${API}/api/v1/admin/gallery`)).status()).toBe(401);
  });
});

test.describe("Offers (editor prepares, admin publishes)", () => {
  test.use({ storageState: path.join(AUTH, "admin.json") });

  test("editor: validation, draft saved hidden, no Publish; API refuses publishing", async ({
    browser,
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop", "creates a shared code once");
    const ctx = await browser.newContext({ storageState: path.join(AUTH, "editor.json") });
    const page = await ctx.newPage();
    await page.goto("/offers");
    await expect(page.getByRole("heading", { name: "Offers & Promo Codes" })).toBeVisible();
    await page.getByRole("button", { name: "Add Offer" }).click();
    const d = await dialog(page);
    // Validation: errors only after interaction, and percentages above 100 are refused.
    await expect(d.locator("[aria-invalid='true']")).toHaveCount(0);
    await d.getByRole("button", { name: "Save Offer" }).click();
    await expect(d.getByText("Enter the offer title.")).toBeVisible();
    await d.getByLabel("Title").fill("Test Offer E2E");
    await d.getByLabel("Discount type").selectOption("percentage");
    const value = d.getByLabel(/^Discount value/);
    await value.fill("150");
    await value.blur();
    await expect(d.getByText("A percentage discount cannot be more than 100%.")).toBeVisible();
    await value.fill("10");
    await expect(d.getByText("A percentage discount cannot be more than 100%.")).toHaveCount(0);
    await d.getByLabel(/^Promo code/).fill("AB"); // spaces are removed as typed; too short
    await d.getByLabel(/^Promo code/).blur();
    await expect(d.getByText("Use 3–32 letters, digits or hyphens (no spaces).")).toBeVisible();
    await d.getByLabel(/^Promo code/).fill("TEST-E2E10");
    // Relative to today in Colombo (the form refuses past start dates), so the test never expires.
    const colombo = (days: number) =>
      new Date(Date.now() + 5.5 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
    await d.getByLabel("Start date").fill(colombo(0));
    await d.getByLabel("End date").fill(colombo(-1));
    await d.getByLabel("End date").blur();
    await expect(d.getByText("The end date must be on or after the start date.")).toBeVisible();
    await d.getByLabel("End date").fill("");
    await expect(d.getByLabel("Preview")).toContainText("TEST-E2E10");
    await expect(d.getByLabel("Preview")).toContainText("10% off");
    await d.getByRole("button", { name: "Save Offer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "saved as hidden" })).toBeVisible();
    const row = page.locator("tr[data-offer='TEST-E2E10']");
    await expect(row).toContainText("Hidden");
    await expect(row.getByRole("button", { name: /Publish/ })).toHaveCount(0);
    // The API itself refuses an editor publishing.
    const [offer] = await db<{ id: string }>("SELECT id FROM offers WHERE promo_code = 'TEST-E2E10'");
    const token = await apiToken(request, "editor", "10.70.0.1");
    expect(
      (
        await request.patch(`${API}/api/v1/admin/offers/${offer!.id}/publication`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { isPublished: true },
        })
      ).status(),
    ).toBe(403);
    // Not public while hidden.
    expect(((await (await request.get(`${API}/api/v1/offers`)).json()).items as unknown[]).length).toBe(0);
    await ctx.close();
  });

  test("admin publishes; the public API lists it; hide removes it", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop", "uses the shared code created above");
    await page.goto("/offers");
    const row = page.locator("tr[data-offer='TEST-E2E10']");
    await row.getByRole("button", { name: "Publish Test Offer E2E" }).click();
    await (await dialog(page)).getByRole("button", { name: "Publish" }).click();
    await expect(row).toContainText("Active");
    const pub = (await (await request.get(`${API}/api/v1/offers`)).json()).items as { promoCode: string }[];
    expect(pub.map((o) => o.promoCode)).toEqual(["TEST-E2E10"]);
    const check = await request.post(`${API}/api/v1/offers/validate`, {
      headers: { "X-Forwarded-For": "10.70.0.2" },
      data: { code: "test-e2e10" },
    });
    expect((await check.json()).status).toBe("valid");
    await row.getByRole("button", { name: "Hide Test Offer E2E" }).click();
    await (await dialog(page)).getByRole("button", { name: "Hide" }).click();
    await expect(row).toContainText("Hidden");
    expect(((await (await request.get(`${API}/api/v1/offers`)).json()).items as unknown[]).length).toBe(0);
    const audit = await db<{ action: string }>("SELECT action FROM audit_log WHERE entity_type = 'offer' ORDER BY id");
    expect(audit.map((a) => a.action)).toEqual(["offer.create", "offer.publish", "offer.hide"]);
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
    await expect(
      page.getByRole("status").filter({ hasText: "“Test Delete Me” was deleted permanently." }),
    ).toBeVisible();
    expect((await request.get(`${API}/api/v1/admin/products/${id}`, { headers: auth })).status()).toBe(404);
    await adminCtx.close();
  });
});

/** Submits TEST feedback through the public API (as the website does). */
async function submitFeedback(
  request: import("@playwright/test").APIRequestContext,
  name: string,
  ip: string,
  message = "Test feedback message for the isolated test database.",
) {
  const r = await request.post(`${API}/api/v1/feedback`, {
    headers: { "X-Forwarded-For": ip, "Content-Type": "application/json" },
    data: {
      idempotencyKey: crypto.randomUUID(),
      name,
      rating: 4,
      message,
      location: "Test Town",
      language: "ta",
      consent: true,
      consentVersion: "2026-11-20",
    },
  });
  expect(r.status()).toBe(201);
}
const publicFeedbackNames = async (request: import("@playwright/test").APIRequestContext) =>
  ((await (await request.get(`${API}/api/v1/feedback`)).json()).items as { name: string }[]).map((i) => i.name);

test.describe("Customer feedback (editor)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("pending by default, approve publishes, hide removes; restore is admin-only", async ({
    page,
    request,
  }, info) => {
    const t = tag(info.project.name);
    const approveMe = `Test Reviewer A${t}`;
    const rejectMe = `Test Reviewer R${t}`;
    const ip = `10.40.${info.project.name === "mobile" ? 2 : 1}.1`;
    await submitFeedback(request, approveMe, ip);
    await submitFeedback(request, rejectMe, ip, "Another test feedback message for the test database.");
    expect(await publicFeedbackNames(request)).not.toContain(approveMe);

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /Feedback Awaiting Review/ })).toBeVisible();
    await page.goto("/feedback");
    await expect(page.getByRole("heading", { name: "Customer Feedback" })).toBeVisible();
    const row = page.locator("li", { hasText: approveMe });
    await expect(row).toContainText("Pending");
    await expect(row).toContainText("Written in Tamil");
    await expect(row.getByRole("img", { name: "4 out of 5 stars" })).toBeVisible();

    // Approve (with confirmation) → public.
    await row.getByRole("button", { name: new RegExp(`Approve.*${approveMe}`) }).click();
    const d = await dialog(page);
    await expect(d).toContainText("Approve and publish?");
    await d.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Approved" })).toBeVisible();
    expect(await publicFeedbackNames(request)).toContain(approveMe);

    // Reject the other → never public.
    const rejectRow = page.locator("li", { hasText: rejectMe });
    await rejectRow.getByRole("button", { name: new RegExp(`Reject.*${rejectMe}`) }).click();
    const d2 = await dialog(page);
    await d2.getByLabel("Internal note (optional)").fill("Test note");
    await d2.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Rejected" })).toBeVisible();
    expect(await publicFeedbackNames(request)).not.toContain(rejectMe);

    // Hide the approved one → removed from the website; editors cannot restore it.
    await page
      .getByRole("button", { name: /^Approved/ })
      .first()
      .click();
    const approvedRow = page.locator("li", { hasText: approveMe });
    await approvedRow.getByRole("button", { name: new RegExp(`Hide.*${approveMe}`) }).click();
    const d3 = await dialog(page);
    await d3.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Hidden" })).toBeVisible();
    expect(await publicFeedbackNames(request)).not.toContain(approveMe);
    await page
      .getByRole("button", { name: /^Hidden/ })
      .first()
      .click();
    await expect(page.locator("li", { hasText: approveMe }).getByRole("button", { name: /Restore/ })).toHaveCount(0);

    const audit = await db<{ action: string }>(
      "SELECT a.action FROM audit_log a JOIN customer_feedback f ON f.id::text = a.entity_id WHERE f.display_name = $1 ORDER BY a.id",
      [approveMe],
    );
    expect(audit.map((a) => a.action)).toEqual(["feedback.approve", "feedback.hide"]);
  });
});

test.describe("Customer feedback (admin)", () => {
  test.use({ storageState: path.join(AUTH, "admin.json") });

  test("admin restores hidden feedback; anonymous access is refused", async ({ page, request }, info) => {
    const name = `Test Reviewer H${tag(info.project.name)}`;
    await submitFeedback(request, name, `10.41.${info.project.name === "mobile" ? 2 : 1}.1`);
    const id = (await db<{ id: string }>("SELECT id FROM customer_feedback WHERE display_name = $1", [name]))[0]!.id;
    expect((await request.post(`${API}/api/v1/admin/feedback/${id}/approve`, { data: {} })).status()).toBe(401);
    await db(
      "UPDATE customer_feedback SET status = 'hidden', moderated_at = now(), approved_at = now() WHERE id = $1",
      [id],
    );
    await page.goto("/feedback?status=hidden");
    const row = page.locator("li", { hasText: name });
    await row.getByRole("button", { name: new RegExp(`Restore.*${name}`) }).click();
    const d = await dialog(page);
    await d.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Restored" })).toBeVisible();
    expect(await publicFeedbackNames(request)).toContain(name);
  });

  test("category: staff enter Tamil / Sinhala text; the public API returns it, English unchanged", async ({
    page,
    request,
  }, info) => {
    const name = `Test Translated Category ${tag(info.project.name)}`;
    await page.goto("/categories");
    await page.getByRole("button", { name: /Add Category/ }).click();
    const d = await dialog(page);
    await d.getByLabel(/^Name/).fill(name);
    // The translation editor is collapsed until staff open it.
    await expect(d.getByRole("tab", { name: /Tamil/ })).toHaveCount(0);
    await d.getByRole("button", { name: "Add Tamil / Sinhala text" }).click();
    await d.getByRole("tab", { name: /Tamil/ }).click();
    await d.getByLabel("Category name — Tamil").fill("சோதனை வகை");
    await d.getByRole("tab", { name: /Sinhala/ }).click();
    await d.getByLabel("Category name — Sinhala").fill("පරීක්ෂණ කාණ්ඩය");
    await d.getByRole("button", { name: "Add Category" }).click();
    await expect(page.getByRole("status").filter({ hasText: name })).toBeVisible();
    const items = (await (await request.get(`${API}/api/v1/categories`)).json()).items as {
      name: string;
      translations: Record<string, Record<string, string>>;
    }[];
    const c = items.find((i) => i.name === name)!;
    expect(c.translations).toEqual({ ta: { name: "சோதனை வகை" }, si: { name: "පරීක්ෂණ කාණ්ඩය" } });
  });
});

/**
 * Record action buttons (Edit / Delete / Publish / Hide …): every visible button sits inside the
 * viewport and inside its own action group, buttons in a group never overlap, and below 1280 px
 * each one is a comfortable touch target (≥ 44 px tall, as the shared `.row-actions` CSS sets).
 */
async function actionProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    const groups = [...document.querySelectorAll<HTMLElement>(".row-actions")].filter((g) => g.offsetParent !== null);
    for (const g of groups.slice(0, 12)) {
      const gr = g.getBoundingClientRect();
      const kids = [...g.children].filter((k) => (k as HTMLElement).offsetParent !== null);
      const rects = kids.map((k) => k.getBoundingClientRect());
      rects.forEach((r, i) => {
        const name = (kids[i]!.textContent ?? "").trim().slice(0, 24) || kids[i]!.getAttribute("aria-label");
        if (r.left < -1 || r.right > vw + 1) out.push(`"${name}" outside the viewport`);
        if (r.left < gr.left - 1 || r.right > gr.right + 1) out.push(`"${name}" spills out of its group`);
        if (vw < 1280 && r.height < 43) out.push(`"${name}" only ${Math.round(r.height)}px tall`);
        for (let j = 0; j < i; j++) {
          const o = rects[j]!;
          const overlap =
            Math.min(r.right, o.right) - Math.max(r.left, o.left) > 1 &&
            Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top) > 1;
          if (overlap) out.push(`"${name}" overlaps a neighbouring button`);
        }
      });
    }
    return out;
  });
}

test.describe("Role dashboards, audit log, sign-out and branding", () => {
  test("clean admin logo on sign-in, set-password and the sidebar (not the website's lettered logo)", async ({
    page,
    browser,
  }) => {
    for (const url of ["/login", "/setup-password?token=x"]) {
      await page.goto(url);
      const logo = page.locator("img[data-admin-logo]");
      await expect(logo).toBeVisible();
      await expect(logo).toHaveAttribute("alt", "Pathirana Hardware logo");
      expect(await logo.getAttribute("src")).toContain("logo-mark");
      expect(await logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    }
    const ctx = await browser.newContext({ storageState: path.join(AUTH, "admin.json") });
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.goto("/dashboard");
    const brand = p.locator("aside [data-admin-brand] img");
    await expect(brand).toBeVisible();
    expect(await brand.getAttribute("src")).toContain("logo-mark");
    expect(await brand.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(p.locator("aside [data-admin-brand]")).toContainText("Pathirana Hardware");
    await ctx.close();
  });

  test("admin dashboard: Recent Activity and the Audit Log; editor dashboard: neither (UI and API)", async ({
    browser,
    request,
  }) => {
    const admin = await browser.newContext({ storageState: path.join(AUTH, "admin.json") });
    const a = await admin.newPage();
    await a.goto("/dashboard");
    await expect(a.locator("[data-dashboard='admin']")).toBeVisible();
    await expect(a.locator("[data-recent-activity]")).toBeVisible();
    await expect(a.locator("[data-kpi='Published Products']")).toBeVisible();
    await a.getByRole("link", { name: "Add Category" }).click();
    // The quick action opens the add form (the page then tidies ?new=1 out of the address).
    await expect(a).toHaveURL(/\/categories(\?new=1)?$/);
    await expect(a.locator("dialog[open]")).toBeVisible();
    await expect(a.locator("dialog[open]").getByLabel("Name")).toBeVisible();
    await a.keyboard.press("Escape");
    await a.goto("/audit-log");
    await expect(a.getByRole("heading", { name: "Audit Log", level: 1 })).toBeVisible();
    // The history itself (or its empty state when this test runs on a fresh database).
    // Table on wide screens, one card per event on phones (whichever is shown).
    await expect(
      a.locator("[data-audit-table]:visible, [data-audit-cards]:visible").or(a.getByText("No matching activity.")),
    ).toBeVisible();
    await expect(a.getByRole("heading", { name: "Administrators only" })).toHaveCount(0);
    await admin.close();

    const editor = await browser.newContext({ storageState: path.join(AUTH, "editor.json") });
    const e = await editor.newPage();
    await e.goto("/dashboard");
    await expect(e.locator("[data-dashboard='editor']")).toBeVisible();
    await expect(e.locator("[data-kpi='Published Products']")).toBeVisible();
    await expect(e.locator("[data-recent-activity]")).toHaveCount(0);
    await expect(e.getByRole("link", { name: "Audit Log" })).toHaveCount(0);
    await e.getByRole("button", { name: new RegExp(`${STAFF.editor.name},? Editor$`) }).click();
    await expect(e.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    await expect(e.getByRole("menuitem", { name: "Audit Log" })).toHaveCount(0);
    await e.keyboard.press("Escape");
    await e.goto("/audit-log");
    await expect(e.getByRole("heading", { name: "Administrators only" })).toBeVisible();
    await expect(e.locator("[data-audit-log]")).toHaveCount(0);
    const cookie = (await editor.cookies()).find((c) => c.name === "ph_admin_session")!.value;
    const viaGateway = await request.get("/api/backend/admin/audit-log", {
      headers: { Cookie: `ph_admin_session=${cookie}` },
    });
    expect(viaGateway.status()).toBe(403);
    const token = await apiToken(request, "editor", "10.71.0.1");
    const direct = await request.get(`${API}/api/v1/admin/audit-log`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(direct.status()).toBe(403);
    // The editor's dashboard data carries no audit entries either.
    const dash = await request.get(`${API}/api/v1/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    expect(dash.status()).toBe(200);
    expect(await dash.json()).not.toHaveProperty("activity");
    await editor.close();
  });

  test("sign-out asks first: Cancel keeps the session, for admins and editors", async ({ browser }) => {
    for (const who of ["admin", "editor"] as const) {
      const ctx = await browser.newContext({ storageState: path.join(AUTH, `${who}.json`) });
      const p = await ctx.newPage();
      await p.goto("/dashboard");
      const role = who === "admin" ? "Administrator" : "Editor";
      // Desktop: "<name> <role>"; phones: "Account: <name>, <role>".
      await p.getByRole("button", { name: new RegExp(`${STAFF[who].name},? ${role}$`) }).click();
      await p.getByRole("menuitem", { name: "Sign out" }).click();
      const d = await dialog(p);
      await expect(d.getByRole("heading", { name: "Sign out?" })).toBeVisible();
      await expect(d).toContainText("Are you sure you want to sign out of your account?");
      await d.getByRole("button", { name: "Cancel" }).click();
      await expect(p.locator("dialog[open]")).toHaveCount(0);
      await expect(p).toHaveURL(/\/dashboard$/);
      await p.reload();
      await expect(p).toHaveURL(/\/dashboard$/); // still signed in
      await ctx.close();
    }
  });

  test("date fields: today is the minimum; a past date is refused in the form and by the API", async ({
    browser,
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop", "form checks once");
    const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() + 5.5 * 3_600_000 - 86_400_000).toISOString().slice(0, 10);
    const ctx = await browser.newContext({ storageState: path.join(AUTH, "admin.json") });
    const p = await ctx.newPage();
    await p.goto("/offers");
    await p.getByRole("button", { name: "Add Offer" }).click();
    const d = await dialog(p);
    await expect(d.getByLabel("Start date")).toHaveAttribute("min", today);
    await expect(d.getByLabel("End date")).toHaveAttribute("min", today);
    await d.getByLabel("Start date").fill(yesterday);
    await d.getByLabel("Start date").blur();
    await expect(d.getByText("The start date cannot be earlier than today.")).toBeVisible();
    await d.getByRole("button", { name: "Cancel" }).click();

    // The product form needs a category (TEST data in the throwaway database).
    const token = await apiToken(request, "admin", "10.71.0.2");
    await request.post(`${API}/api/v1/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: "Test Date Category" },
    });
    await p.goto("/products/new");
    // Discounts need a real price (Contact for Price products have none).
    await p.getByRole("radio", { name: "Price in LKR" }).check();
    await p.getByLabel("Discount type").selectOption("percentage");
    const start = p.getByLabel("Start date");
    await expect(start).toBeEnabled();
    await expect(start).toHaveAttribute("min", today);
    await expect(p.getByLabel("End date")).toHaveAttribute("min", today);
    await start.fill(yesterday);
    await start.blur();
    await expect(p.getByText("The discount start date cannot be earlier than today.")).toBeVisible();
    await ctx.close();

    const res = await request.post(`${API}/api/v1/admin/offers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "Test Past Offer", discountType: "percentage", discountValue: 5, startsOn: yesterday },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Website links (WEBSITE_URL)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("View Website in the menu; View on website opens the public page of published records", async ({ page }) => {
    await page.goto("/services");
    // Desktop: sidebar; phones / tablets: inside the menu drawer.
    if (await page.getByRole("button", { name: "Open menu" }).isVisible())
      await page.getByRole("button", { name: "Open menu" }).click();
    const site = page.locator("a[data-view-website]:visible");
    await expect(site).toHaveAttribute("href", `${WEBSITE_URL}/`);
    await expect(site).toHaveAttribute("target", "_blank");
    await expect(site).toHaveAttribute("rel", /noopener/);
    if (await page.getByRole("dialog", { name: "Menu" }).isVisible()) await page.keyboard.press("Escape");

    // An approved service has its own page; the link carries the exact public address.
    const row = page.locator("tr[data-service='bulk-orders']");
    await expect(row.locator("a[data-view-on-website]")).toHaveAttribute(
      "href",
      `${WEBSITE_URL}/services/bulk-orders/`,
    );
    // Hidden services (not on the website) get no link.
    for (const r of await page.locator("tr[data-service]").all()) {
      if ((await r.innerText()).includes("Hidden")) await expect(r.locator("a[data-view-on-website]")).toHaveCount(0);
    }
  });
});

test.describe("Responsive (editor)", () => {
  test.use({ storageState: path.join(AUTH, "editor.json") });

  test("editor pages and action buttons fit at all 10 widths", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "viewports set explicitly");
    test.setTimeout(240_000);
    const routes = [
      "/dashboard",
      "/products",
      "/categories",
      "/brands",
      "/delivery-areas",
      "/quotations",
      "/feedback",
      "/services",
      "/gallery",
      "/offers",
    ];
    for (const width of [320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.51.${width % 250}.${Math.floor(width / 250) + 1}` });
      for (const r of routes) {
        await page.goto(r);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${r} at ${width}px`).toBeLessThanOrEqual(0);
        expect(await actionProblems(page), `${r} at ${width}px`).toEqual([]);
      }
      if ([320, 768, 1440].includes(width)) {
        await page.goto("/dashboard");
        await page.screenshot({
          path: `D:/.tmp/pathirana-screens/admin/editor-dashboard-${width}.png`,
          fullPage: true,
        });
        await page.goto("/services");
        await page.screenshot({ path: `D:/.tmp/pathirana-screens/admin/editor-services-${width}.png`, fullPage: true });
      }
    }
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
      "/feedback",
      "/services",
      "/gallery",
      "/offers",
      "/staff",
      "/audit-log",
      "/settings",
    ];
    for (const width of [320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      // One staff device per width: ~120 page loads would otherwise exceed the API's per-device limit.
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.50.${width % 250}.${Math.floor(width / 250) + 1}` });
      for (const r of routes) {
        await page.goto(r);
        // The real page (not the sign-in or "temporarily unavailable" screen).
        await expect(page).toHaveURL(new RegExp(`${r.replace(/[/]/g, "\\/")}$`));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Temporarily unavailable" })).toHaveCount(0);
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
        expect(await actionProblems(page), `${r} at ${width}px`).toEqual([]);
      }
      // Phones/tablets: drawer; desktop: sidebar.
      if (width < 1024) {
        await page.getByRole("button", { name: "Open menu" }).click();
        const drawer = page.getByRole("dialog", { name: "Menu" });
        await expect(drawer.getByRole("link", { name: "Pathirana Hardware — Admin dashboard" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
      } else {
        await expect(
          page.locator("aside").getByRole("link", { name: "Pathirana Hardware — Admin dashboard" }),
        ).toBeVisible();
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
