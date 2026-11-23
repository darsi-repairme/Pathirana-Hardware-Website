import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { PAGES } from "./helpers";

test.describe("Accessibility (axe, WCAG 2.2 AA)", () => {
  for (const { path } of [...PAGES, { path: "/not-a-real-page/" }]) {
    test(`${path} has no detectable WCAG A/AA violations`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        // Home 360° services ring: only the facing card is active. The other cards are
        // deliberately dimmed (approved design), aria-hidden and out of the tab order — inactive
        // UI, which WCAG 1.4.3 exempts from contrast. The facing card and controls are still checked.
        .exclude('.services-ring-card[aria-hidden="true"]')
        .analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
      expect(summary).toEqual([]);
    });
  }
});

test.describe("Responsive layout", () => {
  test.skip(({ isMobile }) => isMobile, "runs once with explicit viewports");
  const WIDTHS = [320, 360, 390, 768, 1024, 1366, 1440, 1920];

  for (const width of WIDTHS) {
    test(`no horizontal scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const { path } of PAGES) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
        // Primary contact action is always reachable without scrolling: the header Call button on
        // wide screens; on compact widths Call lives in the menu (header-actions.spec.ts), so the
        // menu button must be on screen.
        const call = page.locator('header a[href="tel:+94712259699"]:visible').first();
        if (await call.count()) await expect(call).toBeInViewport();
        else await expect(page.locator("header").getByRole("button", { name: "Open menu" })).toBeInViewport();
      }
    });
  }

  test("touch targets in the header are at least 44px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    const sizes = await page
      .locator("header a:visible, header button:visible")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)));
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(44);
  });

  test("content remains visible with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const hidden = await page
      .locator(".hero-intro, .hero-intro *, .hero-image, [class*=about-], .rv, .rv-img")
      .evaluateAll((els) => els.filter((el) => Number(getComputedStyle(el).opacity) < 1).length);
    expect(hidden).toBe(0);
  });
});
