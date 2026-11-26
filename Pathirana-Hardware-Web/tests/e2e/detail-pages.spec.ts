import { expect, MOCK_SERVICES, test } from "./fixtures";
import { trackErrors } from "./helpers";

const SERVICES = [
  ["building-material-supply", "Building Material Supply"],
  ["home-site-delivery", "Home / Site Delivery"],
  ["bulk-orders", "Bulk Orders"],
  ["product-reservations", "Product Reservations"],
  ["product-advice", "Product Advice & Guidance"],
  ["contractor-support", "Contractor & Project Support"],
] as const;

const NO_SHOP = /Rs\.?\s?\d|\$\d|in stock|% off|add to cart|checkout|free delivery|guaranteed/i;

test.describe("Detail pages", () => {
  test.setTimeout(180_000);

  test("six service pages: description, what to ask, steps, WhatsApp, call, back link", async ({ page }) => {
    const errors = trackErrors(page);
    for (const [slug, title] of SERVICES) {
      await page.goto(`/services/${slug}/`);
      await expect(page.locator("h1")).toHaveText(title);
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Services" }),
      ).toHaveAttribute("href", "/services/");
      await expect(page.getByRole("heading", { name: "What you can enquire about" })).toBeVisible();
      await expect(page.locator("section[aria-labelledby='service-steps'] ol > li")).toHaveCount(3);
      await expect(page.locator(".three-host").first()).toBeAttached();
      const wa = page.locator("main a[href^='https://wa.me/94712259699?text=']").first();
      expect(new URL((await wa.getAttribute("href"))!).searchParams.get("text")).toBe(
        `Hello Pathirana Hardware, I would like to enquire about ${title}.`,
      );
      await expect(page.locator("main a[href='tel:+94712259699']").first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to Services" })).toHaveAttribute("href", "/services/");
      await expect(page.locator("main")).toContainText("confirm them with the shop");
      await expect(page.locator("main")).not.toContainText(NO_SHOP);
    }
    expect(errors).toEqual([]);
  });

  test("built-in product pages no longer exist; unknown slugs return 404", async ({ request }) => {
    // The site shows only the live database: no pre-built category / product-type pages.
    for (const path of [
      "/products/categories/",
      "/products/categories/steel-products/",
      "/products/plywood/",
      "/products/not-a-product/",
      "/services/not-a-service/",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test("live category page: heading, breadcrumb and back, from the API only", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/products/");
    // Category tiles link to the live category page (categories come from the mocked API).
    await page
      .locator("section[aria-labelledby='categories-title'] a[href='/products/category/?slug=steel-products']")
      .click();
    await expect(page).toHaveURL(/\/products\/category\/\?slug=steel-products$/);
    await expect(page.locator("h1")).toHaveText("Steel Products");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products/");
    await expect(page.locator("main")).not.toContainText(NO_SHOP);
    await page.goBack();
    await expect(page).toHaveURL(/\/products\/$/);
    expect(errors).toEqual([]);
  });

  test("service page shows only the live service: hidden → not available; API down → unavailable", async ({ page }) => {
    const API = process.env.NEXT_PUBLIC_API_URL!.replace(/\/+$/, "");
    // Published list without bulk-orders: its pre-built page says "not available".
    await page.route(`${API}/api/v1/services`, (r) =>
      r.fulfill({
        json: { items: MOCK_SERVICES.filter((s) => s.slug !== "bulk-orders") },
      }),
    );
    await page.goto("/services/bulk-orders/");
    await expect(page.locator("[data-service-state='hidden']")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Service not available");
    // The delivered HTML holds no built-in service text (it loads from the API in the browser).
    const html = await (await page.request.get("/services/home-site-delivery/")).text();
    expect(html).not.toContain(MOCK_SERVICES.find((s) => s.slug === "home-site-delivery")!.description);
    // API unreachable: an honest "temporarily unavailable" state, never built-in text.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.route(`${API}/api/v1/services`, (r) => r.abort("internetdisconnected"));
    await page.goto("/services/home-site-delivery/");
    await expect(page.locator("[data-service-state='unavailable']")).toBeVisible();
    await expect(page.locator("main a[href*='wa.me']")).toHaveCount(0);
  });
});

test.describe("FAQ and contact", () => {
  test("FAQ accordion opens and closes with mouse and keyboard; honest answers", async ({ page }) => {
    await page.goto("/faq/");
    const items = page.locator("details");
    expect(await items.count()).toBeGreaterThanOrEqual(12);
    const pay = page.locator("details#pay-online");
    await expect(pay).not.toHaveAttribute("open", "");
    await pay.locator("summary").click();
    await expect(pay).toHaveAttribute("open", "");
    await expect(pay).toContainText("No. This website is for information and enquiries only");
    await pay.locator("summary").click();
    await expect(pay).not.toHaveAttribute("open", "");
    await page.locator("details#delivery summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details#delivery")).toHaveAttribute("open", "");
    await expect(page.locator("main")).not.toContainText(/AI (assistant|bot) (is|answers)|pay online now/i);
  });

  test("contact page: call, WhatsApp, four social links and FAQ preview", async ({ page }) => {
    await page.goto("/contact/");
    await expect(page.locator("main a[href='tel:+94712259699']").first()).toBeVisible();
    await expect(page.locator("main a[href='https://wa.me/94712259699']").first()).toBeVisible();
    const social = page.locator("section[aria-labelledby='follow-us'] a");
    await expect(social).toHaveCount(4);
    const hrefs = await social.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual([
      "https://www.facebook.com/p/Pathirana-Hardware-100054510037278/",
      "https://www.instagram.com/pathiranahardware?exln=MWw0OWdpdTV2djI4eA==",
      "https://www.linkedin.com/in/pathirana-hardwere-pvt-ltd-a6826943a",
      "https://www.tiktok.com/@pathiranahardwar?_r=1&_t=ZS-9BLldMwKUGl",
    ]);
    for (const a of await social.all()) await expect(a).toHaveAttribute("rel", "noopener noreferrer");
    const faq = page.locator("section[aria-labelledby='contact-faq-title'] details");
    await expect(faq).toHaveCount(5);
    await faq.first().locator("summary").click();
    await expect(faq.first()).toHaveAttribute("open", "");
    await expect(faq.first()).toContainText("confirm whether delivery can be arranged");
    // The Home page's 3D location scene, the verified address and directions link.
    await expect(page.locator("#find-us .three-host")).toHaveCount(1);
    await expect(page.locator("#find-us")).toContainText("Pallama Road, Bangadeniya, Sri Lanka");
    await expect(page.locator("#find-us a", { hasText: "Get Directions" })).toHaveAttribute(
      "href",
      /google\.com\/maps/,
    );
    await expect(page.locator("main a[href='mailto:pathiranahardwarepvt@gmail.com']")).toBeVisible();
    await page.getByRole("link", { name: "View all FAQs" }).click();
    await expect(page).toHaveURL(/\/faq\/$/);
  });

  test("nav highlights the parent section on supporting pages", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop navigation");
    const cases = [
      ["/products/category/?slug=plywood", "Products"],
      ["/services/bulk-orders/", "Services"],
      ["/gallery/", "About Us"],
      ["/faq/", "Contact Us"],
    ] as const;
    for (const [path, label] of cases) {
      await page.goto(path);
      await expect(page.locator("header nav [aria-current=page]:visible")).toHaveText(label);
    }
  });
});
