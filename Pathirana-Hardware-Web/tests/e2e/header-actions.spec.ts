import { expect, test, type Locator } from "./fixtures";

// Header actions (2026-11-21): desktop Search → Offers → Language → Call; phones / tablets
// Search · Offers · Call · Menu, with the language choice inside the menu. No WhatsApp icon in the
// header (WhatsApp stays in the enquiry actions and the menu drawer).
const VIEWPORTS = [
  ["desktop", 1440, 900],
  ["small desktop", 1024, 768],
] as const;
const COMPACT = [
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
  ["small mobile", 320, 720],
] as const;

async function look(l: Locator) {
  return l.evaluate((el) => {
    const s = getComputedStyle(el);
    const svg = el.querySelector("svg")!;
    const r = el.getBoundingClientRect();
    const ir = svg.getBoundingClientRect();
    return {
      left: r.left,
      w: r.width,
      h: r.height,
      cy: r.top + r.height / 2,
      right: r.right,
      bg: s.backgroundColor,
      border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
      color: s.color,
      radius: s.borderRadius,
      iconW: ir.width,
      iconH: ir.height,
      stroke: getComputedStyle(svg).strokeWidth,
      iconCx: ir.left + ir.width / 2 - (r.left + r.width / 2),
    };
  });
}

test.describe("Header actions: Offers, Language and Call", () => {
  test.skip(({ isMobile }) => isMobile, "viewports are set explicitly");

  for (const [name, w, h] of VIEWPORTS) {
    test(`${name} ${w}px: Search → Offers → Language → Call, matching circles`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      const header = page.locator("header");
      await expect(header.locator("a.header-action[href^='https://wa.me/']")).toHaveCount(0);
      const offers = header.locator("[data-offers-button]");
      const lang = header.locator("[data-lang-button]");
      const call = header.locator("a.header-action[href^='tel:']");
      const [o, l, c] = [await look(offers), await look(lang), await look(call)];

      // Order.
      expect(o.left).toBeLessThan(l.left);
      expect(l.left).toBeLessThan(c.left);
      const search =
        w >= 1280
          ? header.getByRole("combobox", { name: "Search products" })
          : header.getByRole("button", { name: "Search products" });
      expect((await search.boundingBox())!.x).toBeLessThan(o.left);

      for (const x of [o, l, c]) {
        expect(x.w).toBeCloseTo(44, 0);
        expect(x.h).toBeCloseTo(44, 0);
        expect(x.bg).toBe("rgba(0, 0, 0, 0)");
        expect(x.iconW).toBeCloseTo(20, 0);
        expect(Math.abs(x.iconCx)).toBeLessThan(1);
        expect(x.right).toBeLessThanOrEqual(w);
        expect(Math.abs(x.cy - c.cy)).toBeLessThan(0.5);
      }
      // Language and Call: identical cream outlined circles.
      for (const x of [l, c]) {
        expect(x.border).toMatch(/^1(\.5)?px solid rgba\(248, 246, 237, 0\.7\)$/);
        expect(x.color).toBe("rgb(248, 246, 237)");
        expect(x.stroke).toBe("1.75px");
      }
      // Offers: brass-gold ring + red "Offers" badge.
      expect(o.border).toBe("2px solid rgb(232, 190, 79)");
      const badge = offers.locator(".header-offers-badge");
      await expect(badge).toHaveText("Offers");
      expect(await badge.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(200, 16, 46)");
      const bb = (await badge.boundingBox())!;
      expect(bb.y).toBeGreaterThanOrEqual(0); // not clipped by the top of the page

      await expect(call).toHaveAttribute("href", "tel:+94712259699");
      await expect(call).toHaveAccessibleName("Call 071 225 9699");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  for (const [name, w, h] of COMPACT) {
    test(`${name} ${w}px: Search · Offers · Menu; language and Call inside the menu`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      const header = page.locator("header");
      await expect(header.locator("[data-lang-button]")).toBeHidden();
      await expect(header.locator("a.header-action[href^='tel:']")).toBeHidden();
      const search = (await header.getByRole("button", { name: "Search products" }).boundingBox())!;
      const offers = (await header.locator("[data-offers-button]").boundingBox())!;
      const menu = (await header.getByRole("button", { name: "Open menu" }).boundingBox())!;
      expect(search.x).toBeLessThan(offers.x);
      expect(offers.x).toBeLessThan(menu.x);
      expect(menu.x + menu.width).toBeLessThanOrEqual(w);
      expect(offers.height).toBeGreaterThanOrEqual(43.5);
      // The brand name (when shown) never runs under the action buttons.
      const brand = header.locator("[data-brand-name]");
      if (await brand.isVisible())
        expect((await brand.boundingBox())!.x + (await brand.boundingBox())!.width).toBeLessThan(search.x);

      await header.getByRole("button", { name: "Open menu" }).click();
      const drawer = page.locator("dialog#mobile-menu");
      const langs = drawer.locator("[data-menu-language] button");
      await expect(langs).toHaveCount(3);
      await expect(langs.nth(0)).toHaveAttribute("aria-pressed", "true");
      const wa = drawer.getByRole("link", { name: /WhatsApp/ });
      await expect(wa).toHaveAttribute("href", "https://wa.me/94712259699");
      // Call: phone icon, label and number, one line each, inside the drawer.
      const call = drawer.locator("[data-menu-call]");
      await expect(call).toHaveAttribute("href", "tel:+94712259699");
      await expect(call).toContainText("Call Pathirana Hardware");
      await expect(call).toContainText("071 225 9699");
      const [cb, wb] = [(await call.boundingBox())!, (await wa.boundingBox())!];
      expect(Math.abs(cb.height - wb.height)).toBeLessThan(1); // one height
      expect(cb.x + cb.width).toBeLessThanOrEqual(w);
      await page.keyboard.press("Escape");
      await expect(drawer).not.toHaveAttribute("open");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("hover and keyboard focus states on Language and Call match", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const header = page.locator("header");
    const buttons = [header.locator("[data-lang-button]"), header.locator("a.header-action[href^='tel:']")];
    const states: string[][] = [];
    for (const btn of buttons) {
      await btn.hover();
      await page.waitForTimeout(300);
      const hover = await btn.evaluate((e) => {
        const s = getComputedStyle(e);
        return `${s.color} ${s.borderTopColor}`;
      });
      await page.mouse.move(0, 400);
      await btn.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      const focus = await btn.evaluate((e) => {
        const s = getComputedStyle(e);
        return `${e.matches(":focus-visible")} ${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
      });
      states.push([hover, focus]);
    }
    expect(states[0]).toEqual(states[1]);
    expect(states[0]![0]).toBe("rgb(184, 134, 11) rgb(184, 134, 11)");
    expect(states[0]![1]).toBe("true solid 3px rgb(232, 190, 79)");
    await expect(header.getByRole("button", { name: /enquiry|cart/i })).toHaveCount(0);
  });

  test("Offers, Language and Call stay on every page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ["/", "/products/", "/services/", "/about/", "/gallery/", "/contact/"]) {
      await page.goto(path);
      await expect(page.locator("header [data-offers-button]")).toBeVisible();
      await expect(page.locator("header [data-lang-button]")).toBeVisible();
      await expect(page.locator("header a.header-action[href='tel:+94712259699']")).toBeVisible();
    }
  });
});

test.describe("Offers panel", () => {
  const OFFER = {
    id: "00000000-0000-4000-8000-000000000009",
    title: "Test Offer",
    benefit: "Test benefit",
    description: "Test description.",
    discountType: "percentage",
    discountValue: 10,
    promoCode: "TEST-CODE1",
    minPurchaseLkr: null,
    appliesTo: "all",
    endsOn: "2099-12-31",
    translations: { ta: { title: "சோதனைச் சலுகை" } },
    products: [],
    categories: [],
  };
  const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  test.skip(!API, "offers need the API build");

  test("shows published offers, copies the code, closes on Escape / outside click; empty state", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    let calls = 0;
    await page.route(`${API}/api/v1/offers`, (r) => {
      calls++;
      return r.fulfill({ json: { items: [OFFER] } });
    });
    await page.goto("/products/");
    await page.waitForLoadState("networkidle");
    expect(calls).toBe(0); // loaded on first open only
    const button = page.locator("[data-offers-button]");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("[data-offers-panel]");
    await expect(panel.locator("[data-offer]")).toContainText("Test Offer");
    await expect(panel).toContainText("TEST-CODE1");
    await expect(panel.getByRole("link", { name: /Request a Quotation/ })).toHaveAttribute(
      "href",
      "/quotation/?promo=TEST-CODE1",
    );
    await panel.locator("[data-copy-code]").click();
    await expect(panel.locator("[data-copy-code]")).toContainText("Copied");
    const box = (await panel.boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
    // Tamil: staff translation of the title.
    await page.evaluate(() => localStorage.setItem("ph-lang", "ta"));
    await page.reload();
    await page.locator("[data-offers-button]").click();
    await expect(page.locator("[data-offers-panel] [data-offer]")).toContainText("சோதனைச் சலுகை");
    await page.mouse.click(5, page.viewportSize()!.height - 5);
    await expect(page.locator("[data-offers-panel]")).toBeHidden();
  });

  test("no published offers → an honest empty state", async ({ page }) => {
    await page.route(`${API}/api/v1/offers`, (r) => r.fulfill({ json: { items: [] } }));
    await page.goto("/");
    await page.locator("[data-offers-button]").click();
    await expect(page.locator("[data-offers-state='empty']")).toContainText(
      "No special offers are available at the moment.",
    );
  });
});
