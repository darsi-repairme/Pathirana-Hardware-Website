import { expect, test, type Page } from "./fixtures";

/** currentSrc of the first matching <img>, once it has loaded. */
async function loadedSrc(page: Page, selector: string) {
  const img = page.locator(selector).first();
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  return img.evaluate((el: HTMLImageElement) => el.currentSrc);
}

test.describe("Brand images", () => {
  test("header and footer use the transparent logo mark (no white box)", async ({ page }) => {
    await page.goto("/");
    expect(await loadedSrc(page, "header img")).toMatch(/\/images\/opt\/pathirana-logo-mark-\d+\.webp$/);
    expect(await loadedSrc(page, "footer a img")).toMatch(/\/images\/opt\/pathirana-logo-mark-\d+\.webp$/);
    const bg = await page
      .locator("header img")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe("rgba(0, 0, 0, 0)");
  });

  test("homepage hero uses the helmet banner; About preview uses the storefront photo", async ({ page }) => {
    await page.goto("/");
    expect(await loadedSrc(page, "section[aria-labelledby='hero-title'] img")).toMatch(
      /pathirana-hero-helmet-banner-\d+\.webp$/,
    );
    expect(await loadedSrc(page, "section[aria-labelledby='about-preview-title'] img")).toMatch(
      /pathirana_hardware_storefront-display-\d+\.webp$/,
    );
    await expect(page.getByRole("link", { name: "Learn More", exact: true })).toHaveAttribute("href", "/about/");
  });

  test("homepage sections use the provided photographs", async ({ page }) => {
    await page.goto("/");
    expect(await loadedSrc(page, "section[aria-labelledby='products-title'] img")).toMatch(
      /pathirana-aisle-materials-\d+\.webp$/,
    );
    // Below lg the full banner is hidden and two cropped copies of the same photo are shown.
    expect(await loadedSrc(page, "section[aria-labelledby='home-contact-title'] img:visible")).toMatch(
      /pathirana-cta-banner-\d+\.webp$/,
    );
    await expect(page.locator("section[aria-labelledby='products-title'] img")).toHaveCount(7);
  });

  // Audit PERF-03: full-size originals are not deployed (pages use images/opt/); gallery photos stay.
  test("unused image originals are left out of the build; optimised copies and gallery photos remain", async ({
    request,
  }) => {
    for (const original of ["pathirana-shop-about.png", "pathirana-hero-helmet-banner.png", "pathirana-logo.png"]) {
      expect((await request.get(`/images/${original}`)).status(), original).toBe(404);
    }
    for (const kept of ["/images/opt/pathirana-hero-helmet-banner-1920.webp", "/images/gallery/storefront-640.webp"]) {
      expect((await request.get(kept)).status(), kept).toBe(200);
    }
  });

  test("About page shows the storefront photo", async ({ page }) => {
    await page.goto("/about/");
    // The section's first <img> is the blurred heading-band background; select the storefront photo itself.
    expect(
      await loadedSrc(page, "section[aria-labelledby='about-title'] img[alt^='Pathirana Hardware storefront']"),
    ).toMatch(/pathirana-shop-about-display-\d+\.webp$/);
  });

  test("hero banner is served at full resolution on high-density desktop screens", async ({ browser, isMobile }) => {
    test.skip(isMobile, "desktop only");
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${process.env.E2E_WEB_PORT || 4173}/`);
    // 1920 slot = the original 1672 px banner (never upscaled).
    expect(await loadedSrc(page, "section[aria-labelledby='hero-title'] img")).toMatch(
      /pathirana-hero-helmet-banner-1920\.webp$/,
    );
    await context.close();
  });
});

test.describe("Three.js visuals", () => {
  // Seven WebGL canvases (software-rendered in headless Chromium): under parallel load, closing the
  // page could exceed the default 30 s. Longer budget (the page is released in fixtures.ts).
  test.describe.configure({ timeout: 60_000 });

  test("services and location canvases render (or keep their fallback) without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    const services = page.locator("section[aria-labelledby='services-title'] .three-host");
    await expect(services).toHaveCount(6);
    const location = page.locator("section[aria-labelledby='find-store-title'] .three-host");
    const webgl = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl"));
    if (webgl) {
      // Canvases start lazily while on screen, so check each one in view.
      await services.first().scrollIntoViewIfNeeded();
      await expect(services.first()).toHaveAttribute("data-ready", "", { timeout: 15000 });
      await location.scrollIntoViewIfNeeded();
      await expect(location).toHaveAttribute("data-ready", "", { timeout: 15000 });
      await expect(location.locator("canvas")).toHaveCount(1);
    } else {
      await expect(location.locator(".three-fallback")).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
