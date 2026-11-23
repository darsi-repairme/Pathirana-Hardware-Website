import { expect, test } from "./fixtures";
import { trackErrors } from "./helpers";

/** Customer website corrections of 2026-11-21 (offers header, i18n subpages, hours, alignment…). */
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

test.describe("Contact › Opening Hours accordion", () => {
  test("collapsed summary; all seven days when expanded; keyboard and aria-expanded", async ({ page }) => {
    await page.goto("/contact/");
    const card = page.locator("[data-opening-hours]");
    const toggle = card.getByRole("button", { name: /Opening Hours/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(card).toContainText("Monday – Saturday: 7:30 AM – 7:00 PM");
    await expect(card).not.toContainText(/open now/i);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(card.locator("[data-opening-days] dt")).toHaveText([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    await expect(card.locator("[data-opening-days] dd")).toHaveText([...Array(6).fill("7:30 AM – 7:00 PM"), "Closed"]);
    await expect(card).toContainText("Public holiday opening hours may differ.");
    await toggle.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("Call and WhatsApp actions", () => {
  test.skip(!API, "the empty-state actions appear with the API build");
  test("empty catalogue state: Call and WhatsApp share height, line and baseline", async ({ page }) => {
    await page.route(`${API}/api/v1/categories`, (r) => r.fulfill({ json: { items: [] } }));
    await page.goto("/products/");
    const actions = page.locator("[data-taxonomy-notice] [data-contact-actions]").first();
    await expect(actions).toBeVisible();
    const boxes = await actions.locator("a").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return { h: r.height, mid: r.top + r.height / 2, display: s.display, align: s.alignItems, ws: s.whiteSpace };
      }),
    );
    expect(boxes).toHaveLength(2);
    for (const b of boxes) {
      expect(b.display).toMatch(/^(inline-)?flex$/); // flex items are blockified to "flex"
      expect(b.align).toBe("center");
      expect(b.ws).toBe("nowrap");
      expect(b.h).toBeGreaterThanOrEqual(44);
    }
    expect(Math.abs(boxes[0]!.mid - boxes[1]!.mid)).toBeLessThan(1);
    await expect(actions.locator("a").nth(1).locator("svg")).toHaveCount(1); // WhatsApp has its icon
  });
});

test.describe("About › Our Location", () => {
  test("directions illustration (not the delivery truck); Get Directions opens Maps", async ({ page }) => {
    await page.goto("/about/");
    const section = page.locator("#where-we-are");
    await expect(section.locator("[data-directions-art]")).toHaveCount(1);
    await expect(section.locator(".delivery-art")).toHaveCount(0);
    await expect(section.locator("[data-directions-art]")).toContainText("Pathirana Hardware");
    await expect(section.getByRole("link", { name: /Get Directions/ })).toHaveAttribute(
      "href",
      /google\.com\/maps|maps\.app/,
    );
    // The Home page keeps its delivery animation.
    await page.goto("/");
    await expect(page.locator(".delivery-art").first()).toBeAttached();
  });

  test("reduced motion: the route is drawn and static", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/about/");
    const art = page.locator("#where-we-are [data-directions-art]");
    await expect(art).toHaveAttribute("data-animated", "false");
    await expect(art.locator("animate, animateMotion[repeatCount]")).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("Footer copyright", () => {
  test("centred RepairMe (Pvt) Ltd. attribution with the current year", async ({ page }) => {
    await page.goto("/");
    const c = page.locator("[data-copyright]");
    await expect(c).toHaveText(`© ${new Date().getFullYear()} RepairMe (Pvt) Ltd. All rights reserved.`);
    expect(await c.evaluate((e) => getComputedStyle(e).textAlign)).toBe("center");
  });
});

test.describe("Language switching on subpages", () => {
  test("switching updates the current subpage in place; kept after refresh and on navigation", async ({
    page,
    isMobile,
  }) => {
    const errors = trackErrors(page);
    const choose = async (native: string) => {
      if (isMobile) {
        // The menu button is found by its target: its label is translated once a language is chosen.
        await page.locator("header button[aria-controls='mobile-menu']").click();
        await page.locator("[data-menu-language] button", { hasText: native }).click();
        await page.keyboard.press("Escape");
      } else {
        await page.locator("header [data-lang-button]").click();
        await page.getByRole("menuitemradio", { name: native }).click();
      }
    };
    await page.goto("/gallery/");
    await expect(page.locator("main")).toContainText("Our store on Pallama Road, Bangadeniya");
    await choose("தமிழ்");
    await expect(page).toHaveURL(/\/gallery\/$/);
    await expect(page.locator("main")).toContainText("பல்லம வீதி");
    await expect(page.locator("main")).not.toContainText("Those marked “Illustration”");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ta-LK");
    await expect(page.locator("main")).toContainText("பல்லம வீதி");
    await page.goto("/services/home-site-delivery/");
    await expect(page.locator("h1")).toContainText("வீடு");
    await choose("සිංහල");
    await expect(page).toHaveURL(/\/services\/home-site-delivery\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "si-LK");
    await page.goBack();
    await expect(page).toHaveURL(/\/gallery\/$/);
    await expect(page.locator("main")).toContainText("පල්ලම පාර");
    expect(errors).toEqual([]);
  });
});

test.describe("Quotation promo code", () => {
  test.skip(!API, "online quotations need the API build");
  test("prefilled from an offer, checked, sent with the request and added to WhatsApp", async ({ page }) => {
    await page.route(`${API}/api/v1/delivery-areas`, (r) =>
      r.fulfill({
        json: { items: [{ id: "a1", name: "Chilaw", district: null, postalCode: null, notes: null }], total: 1 },
      }),
    );
    await page.route(`${API}/api/v1/offers/validate`, (r) =>
      r.fulfill({ json: { code: "TEST-CODE1", status: "valid", offer: { title: "Test Offer" } } }),
    );
    let sent: Record<string, unknown> | null = null;
    await page.route(`${API}/api/v1/quotations`, async (r) => {
      const body = r.request().postDataBuffer()!.toString("latin1");
      sent = JSON.parse(Buffer.from(body.match(/name="data"\r\n\r\n([\s\S]*?)\r\n--/)![1]!, "latin1").toString("utf8"));
      return r.fulfill({
        status: 201,
        json: { reference: "PHQ-261121-TEST3", photoCount: 0, duplicate: false, promoStatus: "valid" },
      });
    });
    await page.context().route("https://wa.me/**", (r) => r.fulfill({ contentType: "text/html", body: "ok" }));
    await page.goto("/quotation/?promo=test-code1");
    const promo = page.getByLabel(/Promo code/);
    await expect(promo).toHaveValue("TEST-CODE1");
    await promo.focus();
    await promo.blur();
    await expect(page.locator("[data-promo-status='valid']")).toContainText("matches a current offer");
    await page.getByLabel("Product 1").fill("Test Cement");
    await page.getByLabel("Quantity").first().fill("5");
    await page.getByLabel("Name").fill("Test Customer");
    await page.getByLabel("Phone / WhatsApp number").fill("0712345678");
    await page.getByLabel("Location").selectOption("Chilaw");
    await page.getByLabel("I will collect from the store").check();
    await page.getByLabel(/may use my submitted contact details/).check();
    await page.getByRole("button", { name: "Submit Quotation Request" }).click();
    const saved = page.locator("[data-quotation-state='saved']");
    await expect(saved.locator("[data-quotation-reference]")).toHaveText("PHQ-261121-TEST3");
    expect(sent!).toMatchObject({ promoCode: "TEST-CODE1" });
    const href = (await saved.locator("[data-quotation-whatsapp]").getAttribute("href"))!;
    expect(new URL(href).searchParams.get("text")).toContain("Promo Code: TEST-CODE1");
    // An invalid format is caught before sending.
    await page.goto("/quotation/");
    await page.getByLabel(/Promo code/).fill("bad code!");
    await page.getByLabel(/Promo code/).blur();
    await expect(page.getByText("A promo code has only letters, digits and hyphens.")).toBeVisible();
  });
});

test.describe("Mobile hero", () => {
  test.skip(({ isMobile }) => !isMobile, "phone layout");
  test("CTA buttons: equal width, one line, compact; no seam above the photo", async ({ page }) => {
    await page.goto("/");
    const actions = page.locator(".hero-slide.is-active .hero-actions a");
    await expect(actions).toHaveCount(2);
    const [a, b] = [(await actions.nth(0).boundingBox())!, (await actions.nth(1).boundingBox())!];
    expect(Math.abs(a.width - b.width)).toBeLessThan(1);
    expect(a.width).toBeLessThanOrEqual(336.5);
    for (const x of [a, b]) expect(x.height).toBeGreaterThanOrEqual(44);
    for (const el of await actions.all())
      expect(
        await el.evaluate((e) => {
          const label = e.querySelector("span[class*='whitespace-nowrap']") as HTMLElement | null;
          // One line: the label never wraps and nothing overflows the button.
          return !!label && getComputedStyle(label).whiteSpace === "nowrap" && e.scrollWidth <= e.clientWidth + 1;
        }),
      ).toBe(true);
    // The photo box fades in from transparent at its top edge (mask), so no hard edge or 1-px seam.
    const mask = await page
      .locator(".hero-slide.is-active .hero-image")
      .evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage);
    // "to bottom" is the default direction, so browsers may omit it when serialising.
    expect(mask).toMatch(/linear-gradient\((to bottom, )?(rgba\(0, 0, 0, 0\)|transparent) 0%/);
  });
});
