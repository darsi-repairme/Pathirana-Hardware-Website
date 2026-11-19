import { expect, test } from "./fixtures";
import { PAGES } from "./helpers";

const TEL = "tel:+94712259699";
const MAIL = "mailto:pathiranahardwarepvt@gmail.com";
const FB = "https://www.facebook.com/p/Pathirana-Hardware-100054510037278/";

test.describe("Contact details", () => {
  test("contact page exposes working phone, email, Facebook and maps links", async ({ page }) => {
    await page.goto("/contact/");
    await expect(page.locator(`main a[href="${TEL}"]`).first()).toBeVisible();
    await expect(page.locator(`main a[href="${MAIL}"]`).first()).toBeVisible();
    await expect(page.locator(`main a[href="${FB}"]`).first()).toBeVisible();

    const maps = page.locator("#find-us").getByRole("link", { name: /Get Directions/ });
    const href = await maps.getAttribute("href");
    const url = new URL(href!);
    expect(url.hostname).toBe("www.google.com");
    expect(url.pathname).toBe("/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Pathirana Hardware, Pallama Road, Bangadeniya, Sri Lanka");

    // Address is shown; unverified details are not.
    await expect(page.locator("#find-us address")).toContainText("Pallama Road");
    await expect(page.locator("#find-us address")).toContainText("Bangadeniya");
    // WhatsApp uses the client-confirmed number (same as the phone line).
    await expect(page.locator("main a[href*='wa.me']").first()).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/94712259699/,
    );
    // No contact/order forms — only the product search.
    await expect(page.locator("form:not([role=search])")).toHaveCount(0);
  });

  test("external links open safely in a new tab", async ({ page }) => {
    // Ten full page loads with three checks per external link (~26 s on desktop, more in mobile emulation).
    test.slow();
    for (const { path } of PAGES) {
      await page.goto(path);
      const external = page.locator('a[href^="http"]');
      const count = await external.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const a = external.nth(i);
        await expect(a).toHaveAttribute("target", "_blank");
        const rel = (await a.getAttribute("rel")) ?? "";
        expect(rel).toContain("noopener");
        expect(rel).toContain("noreferrer");
      }
    }
  });

  test("no placeholder or unverified phone numbers, hours or ratings appear", async ({ page }) => {
    // Ten full page loads (two of them wait for the live category check) — beyond 30 s in parallel runs.
    test.slow();
    for (const { path } of PAGES) {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      // Every phone-like number must be the verified one.
      const numbers = text.match(/(?:\+94|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g) ?? [];
      for (const n of numbers) expect(n.replace(/\D/g, "").slice(-9)).toBe("712259699");
      expect(text).not.toMatch(/lorem ipsum|xxx[- ]?xxx|555[- ]\d{4}|123[- ]?4567/i);
      expect(text).not.toMatch(/★|\d(\.\d)? ?stars?|years of experience|since (?!1997)(19|20)\d\d/i);
      expect(text).not.toMatch(/open (daily|24)|\d{1,2}[.:]\d{2}\s?(am|pm)/i);

      const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      for (const h of hrefs.filter((x) => x.startsWith("tel:"))) expect(h).toBe(TEL);
      for (const h of hrefs.filter((x) => x.startsWith("mailto:"))) expect(h).toBe(MAIL);
      // TikTok only via the client-supplied profile link.
      for (const h of hrefs.filter((x) => /tiktok\.com/i.test(x)))
        expect(h).toBe("https://www.tiktok.com/@pathiranahardwar?_r=1&_t=ZS-9BLldMwKUGl");
      // Every WhatsApp link uses the confirmed number (optionally with a pre-filled enquiry).
      for (const h of hrefs.filter((x) => /wa\.me|whatsapp/i.test(x)))
        expect(h).toMatch(/^https:\/\/wa\.me\/94712259699(\?text=[^#\s]+)?$/);
    }
  });
});
