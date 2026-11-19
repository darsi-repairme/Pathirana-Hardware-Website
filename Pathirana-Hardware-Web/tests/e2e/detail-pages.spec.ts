import { expect, test } from "./fixtures";
import { expectNoBrokenImages, trackErrors } from "./helpers";

const CATEGORIES = [
  ["building-materials", "Building Materials", ["Cement"]],
  ["steel-products", "Steel Products", ["TOR Bars", "Box Bars"]],
  ["plywood", "Plywood", ["Plywood"]],
  ["doors-windows", "Doors & Windows", ["Doors", "Windows"]],
  ["bathroom-sanitary", "Bathroom & Sanitary", ["Bathroom Sets"]],
  ["gas-cylinders", "Gas Cylinders", ["Gas Cylinders"]],
  ["branded-hardware", "Branded Hardware", []],
] as const;

const PRODUCTS = [
  ["cement", "Cement", "cement"],
  ["tor-bars", "TOR Bars", "TOR bars"],
  ["plywood", "Plywood", "plywood"],
  ["box-bars", "Box Bars", "box bars"],
  ["doors", "Doors", "doors"],
  ["windows", "Windows", "windows"],
  ["bathroom-sets", "Bathroom Sets", "bathroom sets"],
  ["gas-cylinders", "Gas Cylinders", "gas cylinders"],
] as const;

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

  test("seven category pages: heading, breadcrumb, documented products, enquiry", async ({ page }) => {
    const errors = trackErrors(page);
    for (const [slug, title, products] of CATEGORIES) {
      await page.goto(`/products/categories/${slug}/`);
      await expect(page.locator("h1")).toHaveText(title);
      const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(crumbs.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/products/");
      await expect(crumbs.locator("[aria-current=page]")).toHaveText(title);
      const cards = page.locator("section[aria-labelledby='category-products'] li h3");
      await expect(cards).toHaveText([...products]);
      await expect(page.getByRole("link", { name: "Back to Products" })).toHaveAttribute("href", "/products/");
      const wa = page.locator("main a[href^='https://wa.me/94712259699?text=']").first();
      expect(new URL((await wa.getAttribute("href"))!).searchParams.get("text")).toBe(
        `Hello Pathirana Hardware, I would like to enquire about ${title}.`,
      );
      await expect(page.locator("main")).not.toContainText(NO_SHOP);
    }
    // Branded Hardware: honest enquiry panel with the documented brands, no invented products.
    await expect(page.locator("main")).toContainText("Individual products in this category are not listed online yet");
    for (const brand of ["PE+", "Swisstek", "El Toro", "Würth"])
      await expect(page.locator("main")).toContainText(brand);
    expect(errors).toEqual([]);
  });

  test("eight product pages: name, category, enquiry, call and back link", async ({ page }) => {
    const errors = trackErrors(page);
    for (const [slug, name] of PRODUCTS) {
      await page.goto(`/products/${slug}/`);
      await expect(page.locator("h1")).toHaveText(name);
      const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
      await expect(crumbs.locator("li a")).toHaveCount(3);
      await expect(crumbs.locator("li a").nth(1)).toHaveText("Products");
      await expect(crumbs.locator("[aria-current=page]")).toHaveText(name);
      await expect(page.getByRole("link", { name: /^Category:/ })).toHaveAttribute(
        "href",
        /^\/products\/categories\/[a-z-]+\/$/,
      );
      const wa = page.locator("main a[href^='https://wa.me/94712259699?text=']").first();
      await expect(wa).toHaveAttribute("target", "_blank");
      // Batch 5C: the product's own enquiry carries its details and quantity / location placeholders.
      const text = new URL((await wa.getAttribute("href"))!).searchParams.get("text")!;
      expect(text).toContain(`Product: ${name}`);
      expect(text).toContain("Quantity: [please enter]");
      expect(text).toContain("Location: [your town or area]");
      await expect(page.locator("main a[href='tel:+94712259699']").first()).toBeVisible();
      await expect(page.locator("main").getByRole("link", { name: "Request a Quotation" })).toHaveAttribute(
        "href",
        `/quotation/?product=${encodeURIComponent(name)}`,
      );
      await expect(page.getByRole("link", { name: "Back to Products" })).toHaveAttribute("href", "/products/");
      await expect(page.locator("main")).not.toContainText(NO_SHOP);
    }
    await expectNoBrokenImages(page);
    expect(errors).toEqual([]);
  });

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

  test("no categories index and unknown slugs return 404", async ({ request }) => {
    for (const path of ["/products/categories/", "/products/not-a-product/", "/services/not-a-service/"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test("click-through: products → category → product → back, with browser history", async ({ page }) => {
    await page.goto("/products/");
    await page
      .locator("section[aria-labelledby='categories-title'] a[href='/products/categories/steel-products/']")
      .click();
    await expect(page).toHaveURL(/\/products\/categories\/steel-products\/$/);
    await page.getByRole("link", { name: "Box Bars", exact: true }).click();
    await expect(page).toHaveURL(/\/products\/box-bars\/$/);
    await expect(page.locator("h1")).toHaveText("Box Bars");
    await page.goBack();
    await expect(page).toHaveURL(/\/products\/categories\/steel-products\/$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/products\/box-bars\/$/);
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Steel Products" }).click();
    await expect(page.locator("h1")).toHaveText("Steel Products");
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
      ["/products/plywood/", "Products"],
      ["/products/categories/plywood/", "Products"],
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
