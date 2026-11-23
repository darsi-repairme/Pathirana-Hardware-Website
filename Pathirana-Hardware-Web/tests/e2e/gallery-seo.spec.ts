import { expect, test } from "./fixtures";
import { trackErrors } from "./helpers";

const FIXTURES = `http://127.0.0.1:${process.env.E2E_FIXTURES_PORT || 4174}`;

test.describe("Gallery", () => {
  test("production gallery: filters, labelled illustrations, collage and lightbox", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/gallery/");
    // Built with a live API, the Gallery first shows a loading placeholder (never images that may have
    // been hidden in the Admin); with no published Admin photos it then shows the bundled collections.
    await expect(page.locator("[data-gallery-status]")).not.toHaveAttribute("data-gallery-status", "loading");
    // Connected to the API, ONLY the Admin Gallery is shown (the isolated test API has no photos, so
    // the honest empty state appears, never the bundled images). The bundled collections below are
    // checked on a static build (no API).
    const mode = await page.locator("[data-gallery-status]").getAttribute("data-gallery-status");
    if (mode !== "static") {
      await expect(page.locator("[data-gallery-status=empty]")).toBeVisible();
      await expect(page.locator("main ul img")).toHaveCount(0);
      expect(errors).toEqual([]);
      return;
    }
    const thumbs = page.locator("main ul button", { hasText: "View larger image" });
    const total = await thumbs.count();
    expect(total).toBeGreaterThanOrEqual(10);
    // Genuine photos are labelled "Our store"; every other image "Illustration".
    const photoBadges = await page.locator("main ul span.rounded-full", { hasText: /^Our store$/ }).count();
    const illustrationBadges = await page.locator("main ul span.rounded-full", { hasText: /^Illustration$/ }).count();
    expect(photoBadges).toBe(2);
    expect(photoBadges + illustrationBadges).toBe(total);

    // Filters: only real groups; each one narrows the collage.
    const filters = page.getByRole("group", { name: "Filter gallery" }).getByRole("button");
    await expect(filters).toHaveText(["All", "Our Store", "Building Materials", "Hardware & Tools", "Construction"]);
    await page.getByRole("button", { name: "Our Store", exact: true }).click();
    await expect(thumbs).toHaveCount(2);
    await expect(page.locator("main ul span.rounded-full", { hasText: /^Illustration$/ })).toHaveCount(0);
    await expect(page.locator("main ul img").first()).toHaveAttribute("alt", /storefront/);

    // Lightbox: open, next, close, focus return.
    await thumbs.first().click();
    const dialog = page.getByRole("dialog", { name: "Image viewer" });
    await expect(dialog.locator("img")).toHaveAttribute("src", /storefront-\d+\.webp/);
    await expect(dialog).toContainText("Image 1 of 2");
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toContainText("Image 2 of 2");
    await page.getByRole("button", { name: "Close image viewer" }).click();
    await expect(dialog).toBeHidden();
    await expect(thumbs.nth(1)).toBeFocused();

    await page.getByRole("button", { name: "Hardware & Tools", exact: true }).click();
    await expect(thumbs).toHaveCount(6);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(thumbs).toHaveCount(total);
    // No broken image slots.
    const broken = await page.evaluate(async () => {
      for (const img of document.querySelectorAll("main ul img")) img.setAttribute("loading", "eager");
      await new Promise((r) => setTimeout(r, 1500));
      return [...document.querySelectorAll<HTMLImageElement>("main ul img")].filter(
        (i) => i.complete && i.naturalWidth === 0,
      ).length;
    });
    expect(broken).toBe(0);
    expect(errors).toEqual([]);
  });

  test("lightbox: open, keyboard navigation, Escape, focus return (fixture build)", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`${FIXTURES}/gallery/`);
    const thumbs = page.getByRole("button", { name: /Automated test pattern/ });
    await expect(thumbs).toHaveCount(5);

    await thumbs.nth(1).click();
    const dialog = page.getByRole("dialog", { name: "Image viewer" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close image viewer" })).toBeFocused();
    await expect(dialog).toContainText("Image 2 of 5");
    await expect(dialog.locator("img")).toHaveAttribute("alt", "Automated test pattern 2");

    await page.keyboard.press("ArrowRight");
    await expect(dialog).toContainText("Image 3 of 5");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog).toContainText("Image 1 of 5");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog).toContainText("Image 5 of 5");
    await page.getByRole("button", { name: "Next image" }).click();
    await expect(dialog).toContainText("Image 1 of 5");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(thumbs.nth(0)).toBeFocused();

    // Keyboard-only open.
    await thumbs.nth(3).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toContainText("Image 4 of 5");
    await page.getByRole("button", { name: "Close image viewer" }).click();
    await expect(thumbs.nth(3)).toBeFocused();
    expect(errors).toEqual([]);
  });
});

test.describe("SEO", () => {
  test("robots.txt and sitemap.xml are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toMatch(/User-Agent: \*\s+Allow: \//);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });

  test("no canonical or guessed domain is published while the site URL is unset", async ({ page }) => {
    await page.goto("/about/");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toMatch(/localhost:3000|example\.com|vercel\.app/);
  });

  test("structured data uses verified details only", async ({ page }) => {
    await page.goto("/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw!);
    expect(data["@type"]).toBe("HardwareStore");
    expect(data.name).toBe("Pathirana Hardware");
    expect(data.legalName).toBe("Pathirana Hardware (Pvt) Ltd."); // legal name kept in structured data only
    expect(data.telephone).toBe("+94712259699");
    expect(data.address.streetAddress).toBe("Pallama Road");
    expect(data.address.addressLocality).toBe("Bangadeniya");
    expect(data.foundingDate).toBe("1997");
    for (const key of ["aggregateRating", "review", "openingHours", "openingHoursSpecification", "geo"]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  test("Open Graph metadata is present on every page", async ({ page }) => {
    for (const path of ["/", "/about/", "/services/", "/gallery/", "/contact/"]) {
      await page.goto(path);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Pathirana Hardware/);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /.+/);
    }
  });
});
