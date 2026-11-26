import { expect, test } from "./fixtures";
import { trackErrors } from "./helpers";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

test.describe("Gallery", () => {
  test("only Admin photos are shown: loading, then the honest empty state (never bundled images)", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/gallery/");
    // The Admin Gallery is the only source. The mocked API publishes no photos (fixtures.ts), so
    // after loading the honest empty state appears and no image is shown in the collage.
    await expect(page.locator("[data-gallery-status]")).not.toHaveAttribute("data-gallery-status", "loading");
    await expect(page.locator("[data-gallery-status=empty]")).toBeVisible();
    await expect(page.locator("main ul img")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/Illustration”|View larger image/);
    expect(errors).toEqual([]);
  });

  test("API unreachable: an error with retry, never bundled images", async ({ page }) => {
    await page.route(`${API}/api/v1/gallery`, (r) => r.abort("internetdisconnected"));
    await page.goto("/gallery/");
    await expect(page.locator("[data-gallery-status=error]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator("main ul img")).toHaveCount(0);
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
