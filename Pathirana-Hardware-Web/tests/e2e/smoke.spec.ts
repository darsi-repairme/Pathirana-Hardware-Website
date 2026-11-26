import { expect, test } from "./fixtures";
import { trackErrors } from "./helpers";

/**
 * Release smoke checks (quick, sequential-friendly): sticky header, the menu, no page-wide
 * horizontal scroll at phone / tablet / desktop widths, and Tamil / Sinhala on the pages changed
 * for the Services "See More" work. API responses come from the shared fixtures (TEST data).
 */
const WIDTHS = [
  { name: "mobile 390", width: 390, height: 844 },
  { name: "tablet 820", width: 820, height: 1180 },
  { name: "desktop 1280", width: 1280, height: 800 },
] as const;
const PAGES = ["/", "/services/", "/services/all/", "/gallery/", "/products/", "/quotation/", "/contact/"];

test.describe("Smoke", () => {
  test.skip(({ isMobile }) => isMobile, "viewports are set explicitly");

  for (const vp of WIDTHS) {
    test(`${vp.name}: key pages fit the screen; the header stays on top while scrolling`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = trackErrors(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${vp.width}px`).toBeLessThanOrEqual(0);
      }
      // Sticky header on a long page.
      await page.goto("/services/all/");
      await expect(page.locator("[data-services-status='live']")).toBeVisible();
      await page.mouse.wheel(0, 2500);
      await expect.poll(() => page.evaluate(() => window.scrollY), { message: "page scrolled" }).toBeGreaterThan(500);
      const top = await page
        .locator("header")
        .first()
        .evaluate((h) => h.getBoundingClientRect().top);
      expect(Math.abs(top)).toBeLessThanOrEqual(1);
      await expect(page.locator("header").first()).toBeInViewport();
      expect(errors).toEqual([]);
    });
  }

  for (const vp of WIDTHS.slice(0, 2)) {
    test(`${vp.name}: hamburger menu opens, navigates to See More's page and closes`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/services/all/");
      const button = page.locator("header button[aria-controls='mobile-menu']");
      const menu = page.locator("#mobile-menu");
      // The button works once the page is interactive (hydrated); on a slow machine a click can land
      // before that and do nothing. Retry until the menu is open (an open modal menu covers the
      // button, so it is never clicked twice).
      await expect(async () => {
        if (!(await menu.isVisible())) await button.click();
        await expect(menu).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: 15_000 });
      await menu.getByRole("link", { name: "Services", exact: true }).click();
      await expect(page).toHaveURL(/\/services\/$/);
      await expect(menu).toBeHidden();
      await expect(page.locator("[data-see-more] a")).toHaveAttribute("href", "/services/all/");
    });
  }

  for (const [lang, html, allServices, seeMore, script] of [
    ["ta", "ta-LK", "அனைத்துச் சேவைகளும்", "மேலும் பார்க்க", /[஀-௿]/],
    ["si", "si-LK", "සියලු සේවා", "තවත් බලන්න", /[඀-෿]/],
  ] as const) {
    test(`${lang}: See More page and buttons render in ${html}`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.addInitScript((l) => window.localStorage.setItem("ph-lang", l), lang);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/services/all/");
      await expect(page.locator("html")).toHaveAttribute("lang", html);
      await expect(page.locator("h1")).toContainText(allServices);
      await expect(page.locator("[data-service-card]")).toHaveCount(6);
      const main = await page.locator("main").innerText();
      expect(main).toMatch(script);
      expect(main).not.toContain("�");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.goto("/services/");
      await expect(page.locator("[data-see-more] a")).toContainText(seeMore);
      expect(errors).toEqual([]);
    });
  }
});
