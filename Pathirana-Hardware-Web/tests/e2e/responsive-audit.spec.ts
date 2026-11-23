import { expect, test, type Page } from "./fixtures";
import { trackErrors } from "./helpers";

const VIEWPORTS = [
  [320, 720],
  [360, 800],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
] as const;

/** Scroll through the page so lazy images, reveals and 3D canvases start. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 350) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  // 3D scenes start lazily while on screen; bring each one into view like a visitor would.
  const hosts = page.locator(".three-host");
  for (let i = 0; i < (await hosts.count()); i++) {
    await hosts.nth(i).scrollIntoViewIfNeeded();
    await expect(hosts.nth(i)).toHaveAttribute("data-ready", "", { timeout: 15_000 });
  }
}

async function audit(page: Page, label: string) {
  const vw = page.viewportSize()!.width;
  // 1. No horizontal scrolling.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);

  // 2. Header controls fit inside the viewport and are at least 44px.
  const header = await page
    .locator("header a:visible, header button:visible, header input:visible")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  for (const r of header) {
    expect(r.left, `${label}: header control off-screen`).toBeGreaterThanOrEqual(-0.5);
    expect(r.right, `${label}: header control off-screen`).toBeLessThanOrEqual(vw + 0.5);
  }

  // 3. Main sections are stacked in order without overlapping each other.
  const boxes = await page.locator("main > section").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return {
        top: r.top + window.scrollY,
        bottom: r.bottom + window.scrollY,
        label: e.getAttribute("aria-labelledby") ?? e.getAttribute("aria-label"),
      };
    }),
  );
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i]!.top, `${label}: ${boxes[i]!.label} overlaps ${boxes[i - 1]!.label}`).toBeGreaterThanOrEqual(
      boxes[i - 1]!.bottom - 1,
    );
  }

  // 4. Hero: heading and buttons don't collide with the carousel controls.
  const heroText = (await page.locator(".hero-slide.is-active .hero-actions").boundingBox())!;
  const controls = (await page.getByRole("button", { name: "Next slide" }).boundingBox())!;
  const overlap =
    heroText.x < controls.x + controls.width &&
    heroText.x + heroText.width > controls.x &&
    heroText.y < controls.y + controls.height &&
    heroText.y + heroText.height > controls.y;
  expect(overlap, `${label}: hero buttons overlap carousel controls`).toBe(false);
  // Below lg the controls sit in their own row under the banner — never over the
  // helmet/tools artwork — and the banner is a large 4:3 / 3:2 frame, not a strip.
  const stacked = await page
    .locator(".hero-slide.is-active .hero-image")
    .evaluate((el) => getComputedStyle(el).position !== "absolute");
  if (stacked) {
    const banner = (await page.locator(".hero-slide.is-active .hero-image").boundingBox())!;
    const prev = (await page.getByRole("button", { name: "Previous slide" }).boundingBox())!;
    expect(prev.y, `${label}: carousel controls overlap the banner`).toBeGreaterThanOrEqual(
      banner.y + banner.height - 1,
    );
    expect(banner.height / banner.width, `${label}: banner too shallow`).toBeGreaterThanOrEqual(0.66);
    expect(controls.height, `${label}: controls too small to tap`).toBeGreaterThanOrEqual(44);
  }

  // 5. Every image inside main has loaded and sits within the viewport width.
  const imgs = await page.locator("main img").evaluateAll((els) =>
    els.map((i) => {
      const img = i as HTMLImageElement;
      // Visible area = image box clipped by overflow-hidden ancestors
      // (hover zoom / depth animations scale inside their frames).
      let r = img.getBoundingClientRect();
      let visibleWidth = r.width;
      for (let a = img.parentElement; a; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== "visible") {
          const ar = a.getBoundingClientRect();
          r = new DOMRect(
            Math.max(r.left, ar.left),
            r.top,
            Math.min(r.right, ar.right) - Math.max(r.left, ar.left),
            r.height,
          );
          visibleWidth = Math.min(
            visibleWidth,
            Math.min(img.getBoundingClientRect().right, ar.right) - Math.max(img.getBoundingClientRect().left, ar.left),
          );
        }
      }
      // Not rendered (display:none, e.g. the desktop-only Need-help banner below
      // lg) — lazy images there are never fetched, by design.
      const rendered = img.getClientRects().length > 0;
      // Inactive hero slides, and photos scrolled out of a swipe strip (no
      // visible area inside their scroller), are not on screen.
      const clip = img.closest(".hero-slide:not(.is-active)") || visibleWidth <= 0;
      return {
        rendered,
        ok: img.complete && img.naturalWidth > 0,
        right: r.right,
        left: r.left,
        hidden: !!clip,
        src: img.currentSrc,
      };
    }),
  );
  for (const i of imgs) {
    if (!i.rendered) continue;
    expect(i.ok, `${label}: image failed ${i.src}`).toBe(true);
    if (!i.hidden) expect(i.right, `${label}: image overflows ${i.src}`).toBeLessThanOrEqual(vw + 1);
  }

  // 6. 3D canvases match their containers (no stretched rendering, no overflow).
  //    Services-ring cards turned away from the viewer are projected in 3D by
  //    design, so only the facing card's scene is measured.
  const canvases = await page.locator(".three-host").evaluateAll((hosts) =>
    hosts.map((h) => {
      if (h.closest(".services-ring-card:not([data-dist='0'])"))
        return { ready: h.hasAttribute("data-ready"), ok: true, ratio: 1, hostRight: 0 };
      const c = h.querySelector("canvas");
      const hr = h.getBoundingClientRect();
      if (!c) return { ready: h.hasAttribute("data-ready"), ok: true, ratio: 1, hostRight: hr.right };
      const cr = c.getBoundingClientRect();
      return {
        ready: h.hasAttribute("data-ready"),
        ok: Math.abs(cr.width - hr.width) < 1.5 && Math.abs(cr.height - hr.height) < 1.5,
        // Drawing buffer aspect must equal the displayed aspect.
        ratio: c.width / c.height / (cr.width / cr.height),
        hostRight: hr.right,
      };
    }),
  );
  expect(canvases.length).toBe(7); // 6 services + location
  for (const c of canvases) {
    expect(c.ready, `${label}: 3D scene not rendered`).toBe(true);
    expect(c.ok, `${label}: canvas size differs from its container`).toBe(true);
    expect(Math.abs(c.ratio - 1), `${label}: canvas stretched`).toBeLessThan(0.02);
    expect(c.hostRight).toBeLessThanOrEqual(vw + 1);
  }

  // 7. Footer artwork spans the footer width at its natural aspect (never
  //    stretched), and footer text does not spill outside the viewport.
  //    Below lg two cropped layers (object-fit: cover, so never stretched) replace it.
  const panos = await page
    .locator("footer img[src*='pathirana-footer-artwork']")
    .evaluateAll((imgs: HTMLImageElement[]) =>
      imgs
        .filter((i) => i.getClientRects().length > 0)
        .map((i) => {
          const r = i.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            cover: getComputedStyle(i).objectFit === "cover",
            ratio: r.width / r.height / (i.naturalWidth / i.naturalHeight),
            ok: i.complete && i.naturalWidth > 0,
          };
        }),
    );
  expect(panos.length, `${label}: footer artwork layers`).toBe(vw >= 1024 ? 1 : 2);
  for (const pano of panos) {
    expect(pano.ok, `${label}: footer image failed`).toBe(true);
    if (!pano.cover) expect(Math.abs(pano.ratio - 1), `${label}: footer artwork distorted`).toBeLessThan(0.01);
    expect(pano.left).toBeGreaterThanOrEqual(-0.5);
    expect(pano.right).toBeLessThanOrEqual(vw + 0.5);
  }
  const footerText = await page
    .locator("footer a, footer p, footer h2")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0));
  for (const r of footerText) {
    expect(r.left).toBeGreaterThanOrEqual(-0.5);
    expect(r.right, `${label}: footer text overflows`).toBeLessThanOrEqual(vw + 0.5);
  }
}

test.describe("Responsive audit (homepage)", () => {
  test.skip(({ isMobile }) => isMobile, "viewports are set explicitly");
  test.describe.configure({ timeout: 120_000 });

  for (const [w, h] of VIEWPORTS) {
    test(`${w}×${h}: layout, images, carousel, 3D, feedback, footer`, async ({ page }) => {
      // Layout audit: reduced motion makes each 3D scene draw one still frame
      // (software WebGL in CI is slow). Full animation is covered by the
      // live-resize test below and by home-features.spec.ts.
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors = trackErrors(page);
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await expect(page.locator("header img").first()).toBeVisible();
      await expect(page.locator(".hero-slide")).toHaveCount(3);
      await expect(page.getByRole("button", { name: /slide rotation/i })).toHaveCount(0);
      // On short phone/tablet screens the larger banner can push the controls
      // just below the fold; they must be fully visible once scrolled to.
      const nextSlide = page.getByRole("button", { name: "Next slide" });
      await nextSlide.scrollIntoViewIfNeeded();
      await expect(nextSlide).toBeInViewport({ ratio: 0.95 }); // sub-pixel tolerance
      await expect(nextSlide).toBeVisible();
      await scrollThrough(page);
      await expect(page.getByRole("heading", { name: "What Our Customers Say" })).toBeAttached();
      await expect.poll(() => page.locator(".three-host[data-ready]").count(), { timeout: 20_000 }).toBe(7);
      const about = await page
        .locator("section[aria-labelledby='about-preview-title'] img")
        .evaluate((i: HTMLImageElement) => i.currentSrc);
      expect(about).toMatch(/pathirana_hardware_storefront-display-\d+\.webp$/);
      await audit(page, `${w}px`);
      expect(errors).toEqual([]);
    });
  }

  // Short landscape screens use the desktop side-by-side hero (the `land:`
  // variant) instead of a width-sized stacked banner that ran ~3 screens tall.
  for (const [w, h] of [
    [568, 320],
    [667, 375],
    [844, 390],
    [915, 412],
  ] as const) {
    test(`${w}×${h} landscape: compact side-by-side hero, slim header, pages fit`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      const header = (await page.locator("header").first().boundingBox())!;
      expect(header.height, "header height").toBeLessThanOrEqual(65);
      const banner = page.locator(".hero-slide.is-active .hero-image");
      await expect(banner).toHaveCSS("position", "absolute");
      const hero = (await page.locator(".hero-carousel").boundingBox())!;
      expect(hero.height, "hero height").toBeLessThanOrEqual(h * 1.5);
      const intro = (await page.locator(".hero-slide.is-active .hero-intro").boundingBox())!;
      const img = (await banner.boundingBox())!;
      expect(img.x, "banner sits beside the copy").toBeGreaterThan(w * 0.35);
      expect(intro.x).toBeLessThan(img.x);
      for (const path of ["/products/", "/products/plywood/", "/services/bulk-orders/"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(overflow, `${path} overflow`).toBeLessThanOrEqual(0);
        const h1 = (await page.locator("h1").boundingBox())!;
        expect(h1.y + h1.height, `${path} heading within first screen`).toBeLessThanOrEqual(h);
      }
    });
  }

  test("live window resizing 1440 → 1024 → 768 → 390 → 1440 recovers cleanly", async ({ page }) => {
    // Four full scroll passes with live (software-rendered) 3D: needs a longer budget.
    test.setTimeout(240_000);
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await scrollThrough(page);
    await expect.poll(() => page.locator(".three-host[data-ready]").count(), { timeout: 20_000 }).toBe(7);
    // Move to slide 2 so the carousel offset must survive resizing.
    await page.getByRole("button", { name: "Next slide" }).click();
    for (const [w, h] of [
      [1024, 768],
      [768, 1024],
      [390, 844],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(700);
      await scrollThrough(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      const active = (await page.locator(".hero-slide.is-active").boundingBox())!;
      expect(Math.abs(active.x), `${w}px: active slide misaligned`).toBeLessThan(2);
      await audit(page, `resize→${w}px`);
    }
    expect(errors).toEqual([]);
  });
});
