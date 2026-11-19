import { expect, test, type Locator } from "./fixtures";

// WhatsApp and Call sit in the header from lg; below lg they move into the menu drawer.
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

test.describe("Header WhatsApp and Call buttons", () => {
  test.skip(({ isMobile }) => isMobile, "viewports are set explicitly");

  for (const [name, w, h] of VIEWPORTS) {
    test(`${name} ${w}px: identical outlined circles, aligned and spaced`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      const header = page.locator("header");
      const cart = header.locator("a.header-action[href^='https://wa.me/']");
      const call = header.locator("a.header-action[href^='tel:']");
      const a = await look(cart);
      const b = await look(call);

      for (const x of [a, b]) {
        expect(x.w).toBeCloseTo(44, 0);
        expect(x.h).toBeCloseTo(44, 0);
        expect(x.bg).toBe("rgba(0, 0, 0, 0)"); // no fill
        // 1.5px ring; Chromium snaps it to 1px on 1× screens.
        expect(x.border).toMatch(/^1(\.5)?px solid rgba\(248, 246, 237, 0\.7\)$/);
        expect(x.color).toBe("rgb(248, 246, 237)"); // cream
        expect(x.iconW).toBeCloseTo(20, 0);
        expect(x.iconH).toBeCloseTo(20, 0);
        expect(x.stroke).toBe("1.75px");
        expect(Math.abs(x.iconCx)).toBeLessThan(1);
        expect(x.right).toBeLessThanOrEqual(w);
      }
      expect(a.radius).toBe(b.radius);
      expect(Math.abs(a.cy - b.cy)).toBeLessThan(0.5);

      // Same gap between every header control.
      const gaps = await header.locator("div.shrink-0 > *:visible").evaluateAll((els) => {
        const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
        return rs.slice(1).map((r, i) => Math.round(r.left - rs[i]!.right));
      });
      expect(new Set(gaps).size).toBe(1);

      // Desktop: vertically centred with the search field.
      if (w >= 1280) {
        const search = (await header.getByRole("combobox", { name: "Search products" }).boundingBox())!;
        expect(Math.abs(search.y + search.height / 2 - a.cy)).toBeLessThan(0.5);
        expect(search.height).toBeCloseTo(44, 0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  for (const [name, w, h] of COMPACT) {
    test(`${name} ${w}px: logo + name, search and menu only; WhatsApp and Call in the menu`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      const header = page.locator("header");
      await expect(header.locator("a.header-action")).toHaveCount(2);
      for (const a of await header.locator("a.header-action").all()) await expect(a).toBeHidden();
      const name = header.getByText("Pathirana Hardware", { exact: true });
      await expect(name).toBeVisible();
      const nameBox = (await name.boundingBox())!;
      const search = (await header.getByRole("button", { name: "Search products" }).boundingBox())!;
      const menu = (await header.getByRole("button", { name: "Open menu" }).boundingBox())!;
      expect(nameBox.x + nameBox.width).toBeLessThan(search.x); // no overlap
      expect(menu.x + menu.width).toBeLessThanOrEqual(w);
      expect(Math.abs(search.y - menu.y)).toBeLessThan(0.5);

      await header.getByRole("button", { name: "Open menu" }).click();
      const drawer = page.locator("dialog#mobile-menu");
      const wa = drawer.getByRole("link", { name: /WhatsApp/ });
      const call = drawer.getByRole("link", { name: /Call Now/ });
      await expect(wa).toHaveAttribute("href", "https://wa.me/94712259699");
      await expect(wa).toHaveAttribute("target", "_blank");
      await expect(call).toHaveAttribute("href", "tel:+94712259699");
      // The drawer slides in (transform); measure once it has settled on screen.
      await expect
        .poll(async () => (await call.boundingBox())!.x + (await call.boundingBox())!.width)
        .toBeLessThanOrEqual(w);
      const [a, b] = [(await wa.boundingBox())!, (await call.boundingBox())!];
      expect(Math.abs(a.width - b.width)).toBeLessThan(1);
      expect(Math.abs(a.height - b.height)).toBeLessThan(0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(w);
      await page.keyboard.press("Escape");
      await expect(drawer).not.toHaveAttribute("open");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("hover, active and keyboard focus states match", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const header = page.locator("header");
    const buttons = [
      header.locator("a.header-action[href^='https://wa.me/']"),
      header.locator("a.header-action[href^='tel:']"),
    ];
    const states: string[][] = [];
    for (const btn of buttons) {
      await btn.hover();
      await page.waitForTimeout(300);
      const hover = await btn.evaluate((e) => {
        const s = getComputedStyle(e);
        return `${s.color} ${s.borderTopColor} ${getComputedStyle(e.querySelector("svg")!).stroke}`;
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
    expect(states[0]![0]).toBe("rgb(184, 134, 11) rgb(184, 134, 11) rgb(184, 134, 11)"); // brass icon + ring
    expect(states[0]![1]).toBe("true solid 3px rgb(232, 190, 79)");

    // Smooth 200ms colour transition on both.
    for (const btn of buttons) {
      expect(await btn.evaluate((e) => getComputedStyle(e).transitionDuration)).toMatch(/^0\.2s/);
    }

    // Links: official WhatsApp chat (new tab) and a phone call, same verified number.
    const [whatsapp, call] = buttons as [Locator, Locator];
    await expect(whatsapp).toHaveAttribute("href", "https://wa.me/94712259699");
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("rel", /noopener/);
    await expect(whatsapp).toHaveAccessibleName("Chat on WhatsApp 071 225 9699 (opens in a new tab)");
    await expect(call).toHaveAttribute("href", "tel:+94712259699");
    await expect(call).toHaveAccessibleName("Call 071 225 9699");
    // No cart / enquiry-list behaviour left in the navbar.
    await expect(header.getByRole("button", { name: /enquiry|cart/i })).toHaveCount(0);
    await expect(page.locator("dialog#enquiry-basket")).toHaveCount(0);
  });

  test("WhatsApp and Call stay visible on every page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ["/", "/products/", "/services/", "/about/", "/gallery/", "/contact/"]) {
      await page.goto(path);
      await expect(page.locator("header a.header-action[href='https://wa.me/94712259699']")).toBeVisible();
      await expect(page.locator("header a.header-action[href='tel:+94712259699']")).toBeVisible();
    }
  });
});
