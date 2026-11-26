import { expect, test } from "./fixtures";
import { PAGES, expectNoBrokenImages, trackErrors } from "./helpers";

test.describe("All pages", () => {
  // Several pages run WebGL scenes (software-rendered in headless Chromium); under parallel load,
  // loading and closing such a page can take longer than the default 30 s (released in fixtures.ts).
  test.describe.configure({ timeout: 60_000 });

  for (const { path, h1 } of PAGES) {
    test(`${path} loads with one h1, metadata, logo and no errors`, async ({ page }) => {
      const errors = trackErrors(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(h1);
      await expect(page).toHaveTitle(/Pathirana Hardware/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{50,}/);
      await expect(page.locator("html")).toHaveAttribute("lang", "en-LK");

      // Original logo in the header loads.
      const logo = page.locator("header img").first();
      await expect(logo).toBeVisible();
      expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

      await expectNoBrokenImages(page);
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }

  test("page titles are unique", async ({ page }) => {
    const titles = new Set<string>();
    for (const { path } of PAGES) {
      await page.goto(path);
      titles.add(await page.title());
    }
    expect(titles.size).toBe(PAGES.length);
  });

  test("unknown URL shows the 404 page with HTTP 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist/");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("couldn’t find");
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("homepage shows the hero, feature strip, About preview and tagline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("section[aria-labelledby='hero-title']")).toContainText("Pathirana Hardware");
    await expect(page.locator("section[aria-labelledby='about-preview-title']")).toContainText(
      "Shop smarter, save bigger!",
    );
    for (const t of ["Quality Products", "Wide Selection", "Expert Support", "Convenient Location"]) {
      await expect(page.getByRole("heading", { name: t })).toBeVisible();
    }
    // Approved section order.
    const order = await page
      .locator("main section:not([aria-roledescription=carousel]) h2")
      .evaluateAll((els) => els.map((e) => e.textContent?.trim()));
    const expected = [
      "About Pathirana Hardware",
      "Practical Support for Your Building Needs",
      "Everything for Your Building Needs",
      "Your Dream Project Starts Here!",
      "Our Gallery",
      "What Our Customers Say",
      "Find Our Store",
      "Need Help? Get in Touch With Us!",
    ];
    expect(order.filter((t) => expected.includes(t ?? ""))).toEqual(expected);
    // Verified details only — no invented delivery promises, reviews or ratings.
    await expect(page.locator("main")).not.toContainText(/on time|guarantee|\d+\+? years|★/i);
    await expect(page.getByRole("link", { name: "Explore Our Products" }).first()).toHaveAttribute(
      "href",
      "/products/",
    );
    await expect(page.getByRole("link", { name: "Find Our Store" }).first()).toHaveAttribute(
      "href",
      "/contact/#find-us",
    );
  });

  test("security headers are served", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("script-src 'self' 'sha256-");
    expect(h["content-security-policy"]).not.toContain("unsafe-inline' 'sha256");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  });
});

test.describe("Favicon", () => {
  test("uses the green-background icon (no white favicon)", async ({ page, request }) => {
    await page.goto("/");
    const icons = await page
      .locator("link[rel~='icon'], link[rel='apple-touch-icon']")
      .evaluateAll((ls) =>
        ls.map((l) => `${l.getAttribute("rel")} ${l.getAttribute("href")} ${l.getAttribute("sizes")}`),
      );
    expect(icons.some((i) => /^icon \/favicon\.ico/.test(i))).toBe(true);
    expect(icons.some((i) => /^icon \/icon\.png\?\w+/.test(i))).toBe(true);
    expect(icons.some((i) => /^apple-touch-icon \/apple-icon\.png\?\w+/.test(i))).toBe(true);

    const ico = await request.get("/favicon.ico");
    expect(ico.status()).toBe(200);
    const buf = await ico.body();
    expect(buf.readUInt16LE(2)).toBe(1); // ICO type
    expect(buf.readUInt16LE(4)).toBe(3); // 16, 32 and 48 px
    // Sample the 32px icon's corner pixel in the browser: dark green, not white.
    const corner = await page.evaluate(async () => {
      const img = new Image();
      img.src = "/icon.png";
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 32, 32);
      return Array.from(ctx.getImageData(2, 2, 1, 1).data);
    });
    expect(corner[0]).toBeLessThan(60);
    expect(corner[1]).toBeGreaterThan(corner[0]!);
    expect(corner[2]).toBeLessThan(60);
  });
});
