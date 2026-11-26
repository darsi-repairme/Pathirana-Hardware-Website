import { expect, test, type Page, type Request } from "./fixtures";
import { trackErrors } from "./helpers";

/**
 * Batch 5B/5C on the website (API build). API responses are mocked with the
 * backend's real shapes — every name, number and item is TEST data. The real
 * API ↔ database round trip is covered by tests/live-stack.
 */
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
test.skip(!API, "build without NEXT_PUBLIC_API_URL (no online quotation form)");

const AREAS = ["Bangadeniya", "Chilaw", "Pallama", "Anamaduwa", "Arachikattuwa", "Puttalam", "Wennappuwa", "Marawila"];
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqP9fDwAEhgGAWw5cIQAAAABJRU5ErkJggg==",
  "base64",
);

async function mockAreas(page: Page) {
  await page.route(`${API}/api/v1/delivery-areas`, (r) =>
    r.fulfill({
      json: {
        items: AREAS.map((name, i) => ({ id: `a${i}`, name, district: null, postalCode: null, notes: null })),
        total: AREAS.length,
      },
    }),
  );
}

test.describe("Request a Quotation", () => {
  test("all eight service areas + Other; validation; delivery address only for delivery; rows add/remove", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await mockAreas(page);
    await page.goto("/quotation/");
    const location = page.getByLabel("Location");
    await expect(location.locator("option")).toHaveCount(AREAS.length + 2); // placeholder + 8 + Other
    for (const a of AREAS) await expect(location.locator(`option[value='${a}']`)).toHaveCount(1);
    await expect(location.locator("option[value='Other']")).toHaveCount(1);

    // Empty submit → required fields flagged, nothing sent.
    let posted = 0;
    await page.route(`${API}/api/v1/quotations`, (r) => {
      posted++;
      return r.fulfill({ status: 500, json: {} });
    });
    // Consent unticked → Submit disabled, nothing can be sent.
    const submitBtn = page.getByRole("button", { name: "Submit Quotation Request" });
    await expect(submitBtn).toBeDisabled();
    await expect(page.getByLabel(/may use my submitted contact details/)).not.toBeChecked();
    await page.getByLabel(/may use my submitted contact details/).check();
    await submitBtn.click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Please enter a valid 10-digit mobile number.")).toBeVisible();
    await expect(page.getByText("Choose your location.")).toBeVisible();
    await expect(page.getByText("Enter the delivery address.")).toBeVisible();
    await expect(page.getByText("Enter the product.")).toBeVisible();
    await expect(page.getByText("Enter a quantity above 0.")).toBeVisible();
    await expect(page.getByLabel("Name")).toBeFocused();
    expect(posted).toBe(0);

    // Collection: no address field; Other: own location required.
    await page.getByLabel("I will collect from the store").check();
    await expect(page.getByLabel("Delivery address")).toHaveCount(0);
    await location.selectOption("Other");
    await expect(page.getByLabel("Your town or area")).toBeVisible();
    await page.getByLabel("Delivery to my site").check();
    await expect(page.getByLabel("Delivery address")).toBeVisible();

    // Rows: add two more, remove the middle one.
    await page.getByRole("button", { name: "Add another product" }).click();
    await page.getByRole("button", { name: "Add another product" }).click();
    await expect(page.locator("[data-item-row]")).toHaveCount(3);
    await page.getByLabel("Product 2").fill("Row two");
    await page.getByLabel("Product 3").fill("Row three");
    await page.getByRole("button", { name: "Remove product 2" }).click();
    await expect(page.locator("[data-item-row]")).toHaveCount(2);
    await expect(page.getByLabel("Product 2")).toHaveValue("Row three");
    await page.getByPlaceholder("bag, piece…").first().fill("bag");
    // Phone: letters/symbols removed, max 10 digits; too short → translated 10-digit message.
    const phone = page.getByLabel("Phone / WhatsApp number");
    await phone.fill("+94 71-23x");
    await expect(phone).toHaveValue("947123");
    await phone.fill("071234567899999");
    await expect(phone).toHaveValue("0712345678");
    await phone.fill("12");
    await page.getByRole("button", { name: "Submit Quotation Request" }).click();
    await expect(page.getByText("Please enter a valid 10-digit mobile number.")).toBeVisible();
    expect(posted).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("submits items and photos, shows the reference and an editable WhatsApp message", async ({ page, context }) => {
    await mockAreas(page);
    // The automatic WhatsApp tab: reserved blank during the click, then sent to wa.me only after the save.
    const tabs: string[] = [];
    // Never load the real WhatsApp site in tests: a stub page answers for wa.me.
    await context.route("https://wa.me/**", (r) =>
      r.fulfill({ contentType: "text/html", body: "<title>WhatsApp</title>" }),
    );
    context.on("page", (p) => {
      p.waitForURL(/wa\.me/, { timeout: 15_000, waitUntil: "commit" })
        .then(() => tabs.push(p.url()))
        .catch(() => tabs.push(p.url()))
        .finally(() => p.close().catch(() => {}));
    });
    let sent: { data: Record<string, unknown>; photos: number } | null = null;
    await page.route(`${API}/api/v1/quotations`, async (r) => {
      const req: Request = r.request();
      const body = req.postDataBuffer()!.toString("latin1");
      const json = body.match(/name="data"\r\n\r\n([\s\S]*?)\r\n--/)![1]!;
      sent = {
        data: JSON.parse(Buffer.from(json, "latin1").toString("utf8")),
        photos: body.split('name="photos"').length - 1,
      };
      return r.fulfill({ status: 201, json: { reference: "PHQ-261118-TEST2", photoCount: 1, duplicate: false } });
    });

    // Prefilled from a product page.
    await page.goto("/quotation/?product=Test%20Cement&slug=test-cement");
    await expect(page.getByLabel("Product 1")).toHaveValue("Test Cement");
    await page.getByLabel("Quantity").first().fill("10");
    await page.getByPlaceholder("bag, piece…").first().fill("bag");
    await page.getByRole("button", { name: "Add another product" }).click();
    await page.getByLabel("Product 2").fill("Test TOR Bars");
    await page.getByLabel("Quantity").nth(1).fill("2.5");
    await page.getByLabel("Name").fill("Test Customer");
    await page.getByLabel("Phone / WhatsApp number").fill("071 234 5678");
    await page.getByLabel("Location").selectOption("Chilaw");
    await page.getByLabel("Delivery address").fill("Test address");
    await page.getByLabel("Additional notes").fill("Test notes");

    // Photos: preview, remove, type check.
    const file = page.locator("input[type=file][name=photos]");
    await file.setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: PNG },
      { name: "b.png", mimeType: "image/png", buffer: PNG },
    ]);
    await expect(page.getByRole("img", { name: /Selected photo/ })).toHaveCount(2);
    // Previews really render (the CSP allows the browser-local blob: URLs).
    await expect
      .poll(() => page.getByRole("img", { name: "Selected photo 1" }).evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Remove photo 2" }).click();
    await expect(page.getByRole("img", { name: /Selected photo/ })).toHaveCount(1);
    await file.setInputFiles({ name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await expect(page.getByRole("alert").filter({ hasText: "not a JPEG, PNG or WebP" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Selected photo/ })).toHaveCount(1);

    // Phone: digits only (spaces removed as typed), at most 10.
    await expect(page.getByLabel("Phone / WhatsApp number")).toHaveValue("0712345678");
    // No long privacy paragraph and no Privacy Policy link — only the short consent checkbox.
    await expect(page.locator("[data-quotation-privacy]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveCount(0);
    const consent = page.getByLabel(/may use my submitted contact details/);
    await expect(consent).not.toBeChecked();
    await expect(page.locator("[data-quotation-consent]")).toContainText(
      "I agree that Pathirana Hardware may use my submitted contact details, delivery information and photos to process and respond to my quotation request.",
    );
    // Submit is disabled until the box is ticked.
    await expect(page.getByRole("button", { name: "Submit Quotation Request" })).toBeDisabled();
    await expect(page.locator("[data-consent-required]")).toBeVisible();
    await expect(page.locator("form [data-quotation-not-order]")).toContainText(
      "does not confirm an order or reserve stock",
    );
    await expect(page.locator("input[name=website]")).not.toBeInViewport();
    await expect(page.getByRole("textbox", { name: "Website" })).toHaveCount(0); // hidden from assistive tech

    await page.getByLabel(/may use my submitted contact details/).check();
    await page.getByRole("button", { name: "Submit Quotation Request" }).click();

    const saved = page.locator("[data-quotation-state='saved']");
    await expect(saved.locator("[data-quotation-confirmation]")).toHaveText(
      "Thank you. Pathirana Hardware has received your quotation request. Our team will contact you to confirm prices, availability and delivery.",
    );
    await expect(saved.locator("[data-quotation-not-order]")).toHaveText(
      "Submitting a quotation request does not confirm an order or reserve stock. No payment is taken.",
    );
    await expect(saved.locator("[data-quotation-reference]")).toHaveText("PHQ-261118-TEST2");
    await expect(saved).toContainText("only sent when you tap Send");
    expect(sent!.photos).toBe(1);
    expect(sent!.data).not.toHaveProperty("website"); // honeypot left empty by a person
    expect(sent!.data).toMatchObject({
      customerName: "Test Customer",
      phone: "0712345678",
      location: "Chilaw",
      fulfilment: "delivery",
      deliveryAddress: "Test address",
      notes: "Test notes",
      contactConsent: true,
      items: [
        { productName: "Test Cement", productSlug: "test-cement", quantity: "10", unit: "bag" },
        { productName: "Test TOR Bars", quantity: "2.5" },
      ],
    });
    expect(sent!.data.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

    const wa = saved.locator("[data-quotation-whatsapp]");
    await expect(wa).toHaveAttribute("target", "_blank");
    const href = (await wa.getAttribute("href"))!;
    expect(href.startsWith("https://wa.me/94712259699?text=")).toBe(true);
    const text = new URL(href).searchParams.get("text")!;
    expect(text).toBe(
      [
        "Hello Pathirana Hardware,",
        "",
        "I would like to request a quotation.",
        "",
        "Quotation Reference: PHQ-261118-TEST2",
        "",
        "Customer Name: Test Customer",
        "Contact Number: 0712345678",
        "",
        "Requested Items:",
        "1. Test Cement — Quantity: 10 bag",
        "2. Test TOR Bars — Quantity: 2.5",
        "",
        "Delivery/Pickup: Delivery",
        "Location: Chilaw",
        "Delivery Address: Test address",
        "Additional Notes: Test notes",
        "",
        "I attached 1 reference photo to this request on your website.",
        "",
        "Please review my request and confirm prices, stock availability and delivery arrangements.",
        "",
        "Thank you.",
      ].join("\n"),
    );
    // No private photo links, prices or confirmations in the message.
    expect(text).not.toMatch(/https?:|supabase|LKR|confirmed/i);
    await expect(wa).toHaveAccessibleName(/Continue to WhatsApp/);
    // Exactly one WhatsApp tab was opened automatically, and it carries the same message.
    await expect.poll(() => tabs.length).toBe(1);
    expect(tabs[0]).toBe(href);
  });

  test("honest errors from the server (rate limit), nothing claimed", async ({ page }) => {
    await mockAreas(page);
    await page.route(`${API}/api/v1/quotations`, (r) => r.fulfill({ status: 429, json: { message: "Too many" } }));
    await page.goto("/quotation/");
    await page.getByLabel("Name").fill("Test Customer");
    await page.getByLabel("Phone / WhatsApp number").fill("0712345678");
    await page.getByLabel("Location").selectOption("Puttalam");
    await page.getByLabel("I will collect from the store").check();
    await page.getByLabel("Product 1").fill("Test item");
    await page.getByLabel("Quantity").fill("1");
    await page.getByLabel(/may use my submitted contact details/).check();
    await page.getByRole("button", { name: "Submit Quotation Request" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Too many requests" })).toBeVisible();
    await expect(page.locator("[data-quotation-state='saved']")).toHaveCount(0);
    // The tab reserved for WhatsApp is closed again when nothing was saved.
    await expect.poll(() => page.context().pages().length).toBe(1);

    // Server error, photo refused, and no connection: honest message each time, never the confirmation.
    const cases: [(r: import("@playwright/test").Route) => Promise<void>, string][] = [
      [(r) => r.fulfill({ status: 500, json: {} }), "Our server had a problem saving your request"],
      [(r) => r.fulfill({ status: 413, json: {} }), "A photo is too large"],
      [(r) => r.abort("internetdisconnected"), "We could not reach our server"],
    ];
    for (const [handler, message] of cases) {
      await page.unroute(`${API}/api/v1/quotations`);
      await page.route(`${API}/api/v1/quotations`, handler);
      await page.getByRole("button", { name: "Submit Quotation Request" }).click();
      await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
      await expect(page.locator("[data-quotation-state='saved']")).toHaveCount(0);
      await expect(page.getByText("has received your quotation request")).toHaveCount(0);
    }
  });
});

test.describe("Product contact actions and service areas", () => {
  test("live product page: WhatsApp (product details), Call Us, Request a Quotation", async ({ page }) => {
    const product = {
      slug: "test-priced",
      name: "Test Priced Item",
      summary: null,
      description: null,
      category: { slug: "plywood", name: "Plywood" },
      brands: [],
      unit: "sheet",
      availability: "available",
      price: { currency: "LKR", contactForPrice: false, original: "2500.00", discount: null, final: "2500.00" },
      image: null,
      images: [],
    };
    await page.route(`${API}/api/v1/products/test-priced`, (r) => r.fulfill({ json: product }));
    await page.goto("/products/item/?slug=test-priced");
    const detail = page.locator("[data-product-detail='test-priced']");
    const wa = detail.getByRole("link", { name: /Enquire on WhatsApp/ });
    const text = new URL((await wa.getAttribute("href"))!).searchParams.get("text")!;
    expect(text).toMatch(
      /^Hello Pathirana Hardware,\n\nI am interested in Test Priced Item\.\nPrice shown: LKR 2,500\.00 \/ sheet\.\nQuantity: \[enter quantity\]\.\nMy location: \[enter location\]\.\n/,
    );
    // The slug is not a product reference; the local preview address is never used as the product link.
    expect(text).not.toMatch(/Product reference|test-priced\.|127\.0\.0\.1|localhost/);
    expect(text.endsWith("\n\nPlease confirm availability and delivery charges.")).toBe(true);
    await expect(detail.getByRole("link", { name: "Call Us" })).toHaveAttribute("href", "tel:+94712259699");
    const quote = detail.getByRole("link", { name: "Request a Quotation" });
    await expect(quote).toHaveAttribute("href", "/quotation/?product=Test%20Priced%20Item&slug=test-priced");
    await mockAreas(page);
    await quote.click();
    await expect(page.getByLabel("Product 1")).toHaveValue("Test Priced Item");
  });

  test("product-type pages offer the same three actions", async ({ page }) => {
    await page.goto("/products/plywood/");
    const main = page.locator("[data-category-gate='active']");
    const wa = main.getByRole("link", { name: /Enquire on WhatsApp/ }).first();
    expect(new URL((await wa.getAttribute("href"))!).searchParams.get("text")).toContain(
      "\nI am interested in Plywood.\nPrice shown: Contact for Price.\n",
    );
    await expect(main.getByRole("link", { name: "Call Us" })).toHaveAttribute("href", "tel:+94712259699");
    await expect(main.getByRole("link", { name: "Request a Quotation" })).toHaveAttribute(
      "href",
      "/quotation/?product=Plywood",
    );
  });

  test("Home lists all eight service areas; no delivery charges", async ({ page }) => {
    await mockAreas(page);
    await page.goto("/");
    const s = page.locator("section[data-delivery-state]");
    await s.scrollIntoViewIfNeeded();
    const list = s.locator("[data-service-areas] li");
    await expect(list).toHaveText(AREAS);
    await expect(s).not.toContainText(/fee|charge|free delivery|LKR/i);
  });

  test("floating WhatsApp button on every public page", async ({ page }) => {
    for (const path of ["/", "/products/", "/quotation/", "/contact/", "/products/categories/plywood/"]) {
      await page.goto(path);
      const b = page.locator("a[data-floating-whatsapp]");
      await expect(b).toBeVisible();
      await expect(b).toHaveAttribute("href", "https://wa.me/94712259699");
      await expect(b).toHaveAttribute("target", "_blank");
      await expect(b).toHaveAttribute("rel", "noopener noreferrer");
      await expect(b).toBeInViewport();
    }
  });
});
