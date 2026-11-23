import { expect, test } from "./fixtures";

/** The home page URL on the port under test (E2E_WEB_PORT, 4173 by default). */
const HOME = new RegExp(`127\\.0\\.0\\.1:${process.env.E2E_WEB_PORT || 4173}/$`);

const NAV = [
  { name: "Products", url: /\/products\/$/ },
  { name: "Services", url: /\/services\/$/ },
  { name: "About Us", url: /\/about\/$/ },
  { name: "Contact Us", url: /\/contact\/$/ },
  { name: "Home", url: HOME },
];
const FOOTER = [...NAV.slice(0, 3), { name: "Gallery", url: /\/gallery\/$/ }, ...NAV.slice(3)];

test.describe("Desktop navigation", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("main nav links navigate and mark the active page", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const item of NAV) {
      await nav.getByRole("link", { name: item.name, exact: true }).click();
      await expect(page).toHaveURL(item.url);
      await expect(nav.getByRole("link", { name: item.name, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/about/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });
});

test.describe("Footer", () => {
  test("footer links navigate to each page", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("navigation", { name: "Footer" });
    for (const item of FOOTER) {
      await footer.getByRole("link", { name: item.name, exact: true }).click();
      await expect(page).toHaveURL(item.url);
    }
  });

  test("footer shows dynamic year, tagline and verified details", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toContainText(`© ${new Date().getFullYear()} RepairMe (Pvt) Ltd. All rights reserved.`);
    // Customer-facing brand stays "Pathirana Hardware"; the only company suffix is the requested
    // copyright attribution (pending client/legal confirmation).
    await expect(footer).not.toContainText("Pathirana Hardware (Pvt) Ltd");
    expect((await footer.textContent())!.match(/\(Pvt\) Ltd/g)).toHaveLength(1);
    await expect(footer).toContainText("Shop smarter, save bigger!");
    await expect(footer).toContainText("Pallama Road");
    await expect(footer.locator('a[href="tel:+94712259699"]')).toBeVisible();
  });

  test("bottom bar: centred copyright; no legal links or legal pages anywhere", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Legal" })).toHaveCount(0);
    for (const name of ["Privacy Policy", "Refund Policy", "Terms and Conditions"])
      await expect(page.getByRole("link", { name })).toHaveCount(0);
    const copy = page.locator("footer [data-copyright]");
    const box = (await copy.boundingBox())!;
    const vw = page.viewportSize()!.width;
    const parent = (await copy.locator("..").boundingBox())!;
    // Centred within its bar (±2px) and on one line at every width.
    expect(Math.abs(box.x + box.width / 2 - (parent.x + parent.width / 2))).toBeLessThanOrEqual(2);
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
    for (const href of ["/privacy-policy/", "/refund-policy/", "/terms-and-conditions/"]) {
      const res = await page.goto(href);
      expect(res?.status()).toBe(404);
    }
  });
});

test.describe("Mobile menu", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("opens, traps focus, closes with Escape and returns focus", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.click();
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

    // The page behind is inert: tabbing never focuses anything outside the
    // dialog (focus may briefly move to the browser UI, reported as <body>).
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        return !el || el === document.body ? "browser" : el.closest("dialog") ? "dialog" : "page";
      });
      expect(where).not.toBe("page");
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("links navigate and the menu closes", async ({ page }) => {
    await page.goto("/");
    for (const item of NAV.slice(0, 4)) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const dialog = page.getByRole("dialog", { name: "Site menu" });
      await dialog.getByRole("link", { name: item.name, exact: true }).click();
      await expect(page).toHaveURL(item.url);
      await expect(dialog).toBeHidden();
    }
  });

  test("compact header: no Call or WhatsApp icon in the bar; both in the menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('header a.header-action[href="tel:+94712259699"]')).toBeHidden();
    await expect(page.locator('header > div a[href="https://wa.me/94712259699"]:visible')).toHaveCount(0);
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog.locator('a[href="tel:+94712259699"]')).toBeVisible();
    await expect(dialog.locator('a[href="https://wa.me/94712259699"]')).toBeVisible();
  });
});

test.describe("Home navigation and scroll position", () => {
  const FROM = ["/about/", "/services/", "/products/", "/contact/", "/gallery/"];

  for (const from of FROM) {
    test(`logo and Home from ${from} open the homepage at the top`, async ({ page, isMobile }) => {
      for (const via of ["logo", "home"] as const) {
        await page.goto(from);
        await page.evaluate(() => window.scrollTo(0, 900));
        if (via === "logo") {
          await page.locator("header a[href='/']").first().click();
        } else if (isMobile) {
          await page.getByRole("button", { name: "Open menu" }).click();
          await page
            .getByRole("dialog", { name: "Site menu" })
            .getByRole("link", { name: "Home", exact: true })
            .click();
        } else {
          await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home", exact: true }).click();
        }
        await expect(page).toHaveURL(HOME);
        await expect(page.locator("h1")).toHaveText(/Your Trusted Partner/);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
        await expect(page.locator("h1")).toBeInViewport();
      }
    });
  }

  test("logo / Home on the homepage itself scroll back to the top", async ({ page, isMobile }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.locator("header a[href='/']").first().click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
    await expect(page).toHaveURL(HOME);
    if (!isMobile) {
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home", exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
    }
  });

  test("browser back/forward and refresh keep the right page", async ({ page }) => {
    await page.goto("/about/");
    await page.locator("header a[href='/']").first().click();
    await expect(page).toHaveURL(HOME);
    await page.goBack();
    await expect(page).toHaveURL(/\/about\/$/);
    await expect(page.locator("h1")).toHaveText(/About Us/);
    await expect(page.locator("h2#our-story")).toHaveText(/Our Story/);
    await page.goForward();
    await expect(page).toHaveURL(HOME);
    await page.reload();
    await expect(page.locator("h1")).toHaveText(/Your Trusted Partner/);
  });

  test("main buttons go to the right places", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator(".hero-slide.is-active").getByRole("link", { name: "Explore Our Products" }),
    ).toHaveAttribute("href", "/products/");
    await expect(page.getByRole("link", { name: "Learn More", exact: true })).toHaveAttribute("href", "/about/");
    await expect(page.getByRole("link", { name: "View Gallery" })).toHaveAttribute("href", "/gallery/");
    const dirs = page.getByRole("link", { name: /Get Directions/ });
    await expect(dirs).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    await expect(dirs).toHaveAttribute("target", "_blank");
    await page.getByRole("link", { name: "Learn More", exact: true }).click();
    await expect(page).toHaveURL(/\/about\/$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  });
});
