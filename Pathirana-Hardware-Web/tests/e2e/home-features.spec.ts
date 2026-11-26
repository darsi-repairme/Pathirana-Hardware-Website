import { expect, test } from "./fixtures";
import { trackErrors } from "./helpers";

const hero = "section[aria-labelledby='hero-title']";

test.describe("Hero carousel", () => {
  test("three slides advance automatically every ~6 s and cycle 3 → 1", async ({ page }) => {
    await page.goto("/");
    const slides = page.locator(`${hero} [aria-roledescription='slide']`);
    await expect(slides).toHaveCount(3);
    const dots = page.getByRole("button", { name: /^Show slide \d/ });
    await expect(dots).toHaveCount(3);
    // No visible Play/Pause control (removed by request); autoplay still runs.
    await expect(page.locator(hero).getByRole("button", { name: /pause|play/i })).toHaveCount(0);
    await page.mouse.move(1, 1); // not hovering the hero
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    await page.waitForTimeout(4500);
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true"); // not before ~6 s
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true", { timeout: 3000 });
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true", { timeout: 7500 });
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true", { timeout: 7500 }); // cycles
  });

  test("manual arrows, dots and keys cycle; focus and hover pause autoplay", async ({ page, isMobile }) => {
    await page.goto("/");
    const slides = page.locator(`${hero} [aria-roledescription='slide']`);
    const dots = page.getByRole("button", { name: /^Show slide \d/ });
    const prev = page.getByRole("button", { name: "Previous slide" });
    const next = page.getByRole("button", { name: "Next slide" });
    await expect(prev).toBeEnabled();
    await prev.click(); // 1 → 3 (wraps)
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
    await next.click(); // 3 → 1
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    await next.focus();
    await page.keyboard.press("ArrowRight");
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    // Keyboard focus inside the carousel pauses it.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(7000);
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    if (!isMobile) {
      // Hover pauses too.
      await page.locator("body").click({ position: { x: 1, y: 1 } });
      // (Hover the section: the banner image itself is continuously animated.)
      await page.locator(hero).hover({ position: { x: 40, y: 200 } });
      await page.waitForTimeout(7000);
      await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    }

    await dots.nth(1).click();
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
    const slide2Heading = page.getByRole("heading", { name: "Materials for Your Next Project" });
    const vw = page.viewportSize()!.width;
    await expect
      .poll(async () => {
        const b = (await slide2Heading.boundingBox())!;
        return b.x >= 0 && b.x + b.width <= vw + 1;
      })
      .toBe(true);
    await expect(slides.nth(0)).toHaveAttribute("inert", "");
    await expect(slides.nth(0).getByRole("link", { name: "Explore Our Products" })).toHaveAttribute(
      "href",
      "/products/",
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("no Pause button anywhere on the Home sliders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /pause|play (slide|service)/i })).toHaveCount(0);
  });

  test("reduced motion: no autoplay", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForTimeout(7000);
    await expect(page.getByRole("button", { name: /^Show slide \d/ }).nth(0)).toHaveAttribute("aria-current", "true");
    await ctx.close();
  });

  test("swipe / drag changes slide", async ({ page, isMobile }) => {
    await page.goto("/");
    const dots = page.getByRole("button", { name: /^Show slide \d/ });
    const box = (await page.locator(`${hero} .hero-slide.is-active .hero-image`).boundingBox())!;
    const y = box.y + box.height / 2;
    if (isMobile) {
      await page.locator(`${hero} .hero-image`).first().scrollIntoViewIfNeeded();
      const b2 = (await page.locator(`${hero} .hero-slide.is-active .hero-image`).boundingBox())!;
      const cy = b2.y + b2.height / 2;
      await page.dispatchEvent(`${hero} .touch-pan-y`, "pointerdown", {
        pointerId: 7,
        pointerType: "touch",
        clientX: b2.x + b2.width * 0.8,
        clientY: cy,
        isPrimary: true,
        button: 0,
      });
      for (const f of [0.7, 0.5, 0.3, 0.2]) {
        await page.dispatchEvent(`${hero} .touch-pan-y`, "pointermove", {
          pointerId: 7,
          pointerType: "touch",
          clientX: b2.x + b2.width * f,
          clientY: cy,
          isPrimary: true,
        });
      }
      await page.dispatchEvent(`${hero} .touch-pan-y`, "pointerup", {
        pointerId: 7,
        pointerType: "touch",
        clientX: b2.x + b2.width * 0.2,
        clientY: cy,
        isPrimary: true,
      });
    } else {
      await page.mouse.move(box.x + box.width * 0.8, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.6, y, { steps: 5 });
      await page.mouse.move(box.x + box.width * 0.3, y, { steps: 5 });
      await page.mouse.up();
    }
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
  });

  test("swiping back from the first slide cycles to the last", async ({ page, isMobile }) => {
    test.skip(isMobile, "mouse drag");
    await page.goto("/");
    const dots = page.getByRole("button", { name: /^Show slide \d/ });
    const box = (await page.locator(`${hero} .hero-slide.is-active .hero-image`).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.9, y, { steps: 8 });
    await page.mouse.up();
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
  });
});

test.describe("Search", () => {
  test("header search lands on the matching products", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Search products" }).click();
    const input = page.locator("header input[name=q]:visible");
    await input.fill("Plywood");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/products\/\?q=plywood#all-products$/);
    // The query goes to the live catalogue (live-catalogue.spec.ts covers its results).
  });

  test("products page: seven categories linking to their pages, no shop features", async ({ page }) => {
    await page.goto("/products/");
    const tiles = page.locator("section[aria-labelledby='categories-title'] ul > li > a");
    await expect(tiles).toHaveCount(7);
    const ids = [
      "building-materials",
      "steel-products",
      "plywood",
      "doors-windows",
      "bathroom-sanitary",
      "gas-cylinders",
      "branded-hardware",
    ];
    // Every category opens the live category page (categories come from the mocked API).
    for (let i = 0; i < 7; i++)
      await expect(tiles.nth(i)).toHaveAttribute("href", `/products/category/?slug=${ids[i]}`);
    // "View All Categories" expands the collection in place (4 → 7) and collapses again.
    const toggle = page.getByRole("button", { name: "View All Categories" });
    await expect(tiles.filter({ visible: true })).toHaveCount(4);
    await toggle.click();
    await expect(page.getByRole("button", { name: "Show Fewer Categories" })).toHaveAttribute("aria-expanded", "true");
    await expect(tiles.filter({ visible: true })).toHaveCount(7);
    await page.getByRole("button", { name: "Show Fewer Categories" }).click();
    await expect(tiles.filter({ visible: true })).toHaveCount(4);
    // innerText keeps the visual word breaks (textContent would glue "Reset Filters" + "8 products" into "…rs8").
    expect(await page.locator("main").innerText()).not.toMatch(
      /\bRs\.?\s?\d|\$\d|in stock|% off|add to cart|checkout/i,
    );
    // Brands: the live names only. No logo was uploaded (mocked API), so no logo image appears —
    // the bundled logo files are never used.
    const brands = page.locator("section[aria-labelledby='brands-title']");
    for (const brand of ["PE+", "Swisstek", "El Toro", "Würth"]) await expect(brands).toContainText(brand);
    await expect(brands.locator("img")).toHaveCount(0);
    await expect(page.locator("img[src^='/brands/']")).toHaveCount(0);
    await expect(brands).toContainText("They do not indicate an official partnership.");
    await page.goto("/");
    const cards = page.locator("section[aria-labelledby='products-title'] a");
    await expect(cards).toHaveCount(7);
    await expect(cards.nth(2)).toHaveAttribute("href", "/products/category/?slug=plywood");
  });
});

test.describe("Contact actions", () => {
  test("Call and WhatsApp use the confirmed number on every page", async ({ page }) => {
    // Seven page loads, including the homepage and Services 3D scenes (software WebGL): more than
    // the default 30 s can be needed under parallel load, as for the other multi-page tests.
    test.setTimeout(60_000);
    for (const path of ["/", "/products/", "/about/", "/services/", "/gallery/", "/contact/"]) {
      await page.goto(path);
      // Header: Call icon (no WhatsApp icon since 2026-11-21); WhatsApp stays in the footer and menu.
      await expect(page.locator("header a.header-action[href='tel:+94712259699']")).toHaveCount(1);
      await expect(page.locator("header a.header-action[href^='https://wa.me/']")).toHaveCount(0);
      await expect(page.locator("footer a[href='https://wa.me/94712259699']")).toHaveCount(1);
      const wa = await page
        .locator("a[href*='wa.me'], a[href*='whatsapp']")
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      for (const h of wa) expect(h).toMatch(/^https:\/\/wa\.me\/94712259699(\?text=[^#\s]+)?$/);
    }
    await page.goto("/");
    const band = page.locator("section[aria-labelledby='home-contact-title']");
    await expect(band.getByRole("link", { name: /Call now/ })).toHaveAttribute("href", "tel:+94712259699");
    const chat = band.getByRole("link", { name: /Chat on WhatsApp/ });
    await expect(chat).toHaveAttribute("href", "https://wa.me/94712259699");
    await expect(chat).toHaveAttribute("rel", /noopener/);
    // Phones keep Call in the menu (approved compact header); larger screens show it in the header.
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(page.locator("header a[href='tel:+94712259699']:visible")).toHaveAccessibleName("Call 071 225 9699");
    }
  });

  test("customer feedback section is visible with an honest empty state", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "What Our Customers Say" });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect(page.getByText("Customer experiences will be featured here soon.")).toBeVisible();
    // Navigation only appears with two or more approved testimonials.
    await expect(page.getByRole("button", { name: /testimonial/ })).toHaveCount(0);
    // Its own section, separate from the image-led gallery.
    await expect(page.locator("section[aria-labelledby='testimonials-title'] img")).toHaveCount(0);
    // The gallery preview shows only Admin photos (the mocked API publishes none, so its honest
    // empty message instead — never bundled images).
    const preview = page.locator("section[aria-labelledby='gallery-preview-title']");
    await expect(preview.locator("[data-home-gallery=empty]")).toBeVisible();
    await expect(preview.locator("img")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/★|\d(\.\d)? out of 5|stars/i);
  });
});

test.describe("Animations", () => {
  test("Build Better / Live Better animates, resets when scrolled away and replays", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    const bp = page.locator(".blueprint");
    await expect(bp).toContainText("Build Better...");
    await expect(bp).toContainText("Live Better...");
    await expect(bp.locator(".bp-word")).toHaveCount(4);
    await expect(bp).toHaveAttribute("data-inview", "pending");
    // Start state: words hidden, underline undrawn.
    await expect(bp.locator(".bp-w1")).toHaveCSS("opacity", "0");

    for (let pass = 0; pass < 3; pass++) {
      await bp.scrollIntoViewIfNeeded();
      await expect(bp).toHaveAttribute("data-inview", "in");
      // Words reveal, gold underline and blueprint finish drawn.
      await expect(bp.locator(".bp-w4")).toHaveCSS("opacity", "1", { timeout: 5000 });
      await expect
        .poll(() => bp.locator(".bp-gold").evaluate((p) => getComputedStyle(p).strokeDashoffset), { timeout: 6000 })
        .toMatch(/^0(px)?$/);
      await expect
        .poll(
          () =>
            bp
              .locator(".bp-crane path")
              .first()
              .evaluate((p) => getComputedStyle(p).strokeDashoffset),
          {
            timeout: 8000,
          },
        )
        .toMatch(/^0(px)?$/);
      // Scroll fully away → resets, ready to replay.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(bp).toHaveAttribute("data-inview", "pending");
    }
  });

  test("other reveals replay on scroll up and down, and nothing stays hidden", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    const products = page.locator("section[aria-labelledby='products-title'] .reveal-group");
    for (let pass = 0; pass < 2; pass++) {
      await products.scrollIntoViewIfNeeded();
      await expect(products).toHaveAttribute("data-inview", "in");
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(products).toHaveAttribute("data-inview", "pending");
    }
    // After a full pass, every revealed element ends fully visible.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
    });
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const hidden = await page
      .locator("[data-inview='in'] .rv")
      .evaluateAll((els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.99).length);
    expect(hidden).toBe(0);
  });

  test("footer: header-matching green, static artwork, old blueprint animation removed", async ({ page }) => {
    test.setTimeout(60_000); // scrolls past every 3D scene on the way to the footer
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    // Desktop panorama (lg+); below lg two crops of the same artwork are shown
    // instead — check the one actually displayed (the bottom crop on phones).
    const wide = page.viewportSize()!.width >= 1024;
    const bg = footer.locator(
      `${wide ? ".footer-artwork" : ".footer-art-bottom"} img[src*='pathirana-footer-artwork']`,
    );
    await expect(bg).toHaveCount(1);
    await expect.poll(() => bg.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    expect(await bg.evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(
      /\/images\/opt\/pathirana-footer-artwork-\d+\.webp$/,
    );
    expect(await bg.getAttribute("alt")).toBe("");
    // The artwork's own green is transparent, so it cannot show a different shade.
    const corner = await bg.evaluate(async (i: HTMLImageElement) => {
      const c = Object.assign(document.createElement("canvas"), { width: 64, height: 22 });
      const ctx = c.getContext("2d")!;
      ctx.drawImage(i, 0, 0, 64, 22);
      return ctx.getImageData(32, 12, 1, 1).data[3];
    });
    expect(corner).toBe(0);
    // Footer colour = the header's base colour token (forest-900), compared opaque.
    const colours = await page.evaluate(() => {
      const toRgb = (css: string) => {
        const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d")!;
        ctx.fillStyle = css.replace(/\s*\/\s*[\d.]+\s*\)$/, ")"); // drop the header's 90% alpha
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
      };
      return {
        header: toRgb(getComputedStyle(document.querySelector("header")!).backgroundColor),
        footer: toRgb(getComputedStyle(document.querySelector("footer")!).backgroundColor),
      };
    });
    expect(colours.footer).toEqual([7, 46, 29]);
    for (const k of [0, 1, 2]) expect(Math.abs(colours.footer[k]! - colours.header[k]!)).toBeLessThanOrEqual(1);
    // Content grid is horizontally centred (equal left/right margins).
    const margins = await footer.locator("> div.grid").evaluate((g) => {
      const r = g.getBoundingClientRect();
      return [r.left, innerWidth - r.right];
    });
    expect(Math.abs(margins[0]! - margins[1]!)).toBeLessThan(2);
    // Old blueprint line-drawing is gone and nothing in the footer animates.
    await expect(page.locator(".footer-art, footer svg .art-icon, footer .art-shine")).toHaveCount(0);
    const animated = await footer.evaluate(
      (f) => [f, ...f.querySelectorAll("*")].filter((e) => getComputedStyle(e).animationName !== "none").length,
    );
    expect(animated).toBe(0);
    // Six services and four social profiles (exact client links, opened safely).
    await expect(footer.getByRole("navigation", { name: "Our services" }).getByRole("link")).toHaveCount(6);
    const social = await footer
      .locator(".icon-action")
      .evaluateAll((as) =>
        as.map((a) => [a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel"), a.textContent?.trim()]),
      );
    const expected = [
      ["Facebook", "https://www.facebook.com/p/Pathirana-Hardware-100054510037278/"],
      ["Instagram", "https://www.instagram.com/pathiranahardware?exln=MWw0OWdpdTV2djI4eA=="],
      ["LinkedIn", "https://www.linkedin.com/in/pathirana-hardwere-pvt-ltd-a6826943a"],
      ["TikTok", "https://www.tiktok.com/@pathiranahardwar?_r=1&_t=ZS-9BLldMwKUGl"],
    ];
    expect(social).toEqual(
      expected.map(([name, href]) => [
        href,
        "_blank",
        "noopener noreferrer",
        `Pathirana Hardware on ${name} (opens in a new tab)`,
      ]),
    );
    // Keyboard focus is visible on the social icons.
    const first = footer.locator(".icon-action").first();
    await first.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    expect(await first.evaluate((e) => e.matches(":focus-visible") && getComputedStyle(e).outlineStyle)).toBe("solid");
  });

  test("3D scenes animate only while visible and resume when scrolled back", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    const service = page.locator("section[aria-labelledby='services-title'] .three-host").first();
    const map = page.locator("section[aria-labelledby='find-store-title'] .three-host");
    await service.scrollIntoViewIfNeeded();
    await expect(service).toHaveAttribute("data-running", "true", { timeout: 15000 });
    await map.scrollIntoViewIfNeeded();
    await expect(map).toHaveAttribute("data-running", "true", { timeout: 15000 });
    await expect(service).toHaveAttribute("data-running", "false");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(map).toHaveAttribute("data-running", "false");
    await service.scrollIntoViewIfNeeded();
    await expect(service).toHaveAttribute("data-running", "true");
    // Resizing keeps the canvas matched to its container.
    await page.setViewportSize({ width: 820, height: 900 });
    await page.waitForTimeout(500);
    const fit = await service.evaluate((h) => {
      const c = h.querySelector("canvas")!;
      return Math.abs(c.getBoundingClientRect().width - h.getBoundingClientRect().width) < 1.5;
    });
    expect(fit).toBe(true);
  });

  test("Three.js sections fall back to static art when WebGL is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error — test override
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (type.startsWith("webgl")) return null;
        return (orig as (...a: unknown[]) => unknown).apply(this, [type, ...rest]);
      };
    });
    const errors = trackErrors(page);
    await page.goto("/");
    const hosts = page.locator(".three-host");
    await expect(hosts).toHaveCount(7);
    for (const i of [0, 4]) {
      await hosts.nth(i).scrollIntoViewIfNeeded();
      await expect(hosts.nth(i).locator(".three-fallback")).toBeVisible();
      await expect(hosts.nth(i).locator("canvas")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("Six approved services", () => {
  const titles = [
    "Building Material Supply",
    "Home / Site Delivery",
    "Bulk Orders",
    "Product Reservations",
    "Product Advice & Guidance",
    "Contractor & Project Support",
  ];

  test("home page shows all six with 3D visuals, linking to the Services page", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby='services-title']");
    await expect(section.locator("h3")).toHaveText(titles);
    await expect(section.locator(".three-host")).toHaveCount(6);
    await expect(section.locator("a").nth(2)).toHaveAttribute("href", "/services/bulk-orders/");
  });

  test("360° ring: one facing service, controls, select and keyboard; all six reachable", async ({ page }) => {
    // ~12 one-second 3D turns with live WebGL scenes: slow under software rendering.
    test.setTimeout(90_000);
    // Reduced motion: no autoplay, so the manual steps below cannot race the 6 s rotation
    // (there is no Pause button any more).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const ring = page.locator(".services-ring-stage");
    await ring.scrollIntoViewIfNeeded();
    const front = page.locator(".services-ring-card[data-dist='0']");
    await expect(front).toHaveCount(1);
    await expect(front.locator("h3")).toHaveText(titles[0]!);
    await page.getByRole("button", { name: "Next service" }).click();
    await expect(front.locator("h3")).toHaveText(titles[1]!);
    await page.getByRole("button", { name: "Previous service" }).click();
    await page.getByRole("button", { name: "Previous service" }).click();
    await expect(front.locator("h3")).toHaveText(titles[5]!); // wraps round
    for (const [i, t] of titles.entries()) {
      await page.getByRole("button", { name: `Show ${t}` }).click();
      await expect(front.locator("h3")).toHaveText(t);
      await expect(front.locator("a")).toHaveAttribute("href", /\/services\/[a-z-]+\/$/);
      // Only the facing card's link is focusable.
      await expect(page.locator(".services-ring-card a[tabindex='0']")).toHaveCount(1);
      if (i === 0) {
        await page.keyboard.press("ArrowRight");
        await expect(front.locator("h3")).toHaveText(titles[1]!);
      }
    }
    // Facing card fully on screen; no page overflow.
    const vw = page.viewportSize()!.width;
    const b = (await front.locator("a").boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vw);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test("services page lists all six with detail links and WhatsApp enquiries, no invented terms", async ({ page }) => {
    const slugs = [
      "building-material-supply",
      "home-site-delivery",
      "bulk-orders",
      "product-reservations",
      "product-advice",
      "contractor-support",
    ];
    await page.goto("/services/");
    const cards = page.locator("section[aria-labelledby='all-services-title'] ol > li");
    await expect(cards).toHaveCount(6);
    await expect(cards.locator("h3")).toHaveText(titles);
    // Each service: View Service (detail page) and Enquire (WhatsApp) of equal size.
    for (let i = 0; i < 6; i++) {
      const view = cards.nth(i).getByRole("link", { name: `View service: ${titles[i]}` });
      const ask = cards.nth(i).getByRole("link", { name: new RegExp(`^Enquire about ${titles[i]}`) });
      await expect(view).toHaveAttribute("href", `/services/${slugs[i]}/`);
      const [a, b] = [await view.boundingBox(), await ask.boundingBox()];
      expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
      expect(Math.abs(a!.height - b!.height)).toBeLessThan(1);
    }
    // The circular 360° showcase: six 3D objects, six ring markers, one service shown.
    const showcase = page.getByRole("group", { name: "Our services" });
    await expect(showcase.locator(".three-host")).toHaveCount(6);
    await expect(showcase.locator(".services-orbit-node button")).toHaveCount(6);
    // Pause the 6 s autoplay first so slow steps cannot race it (stays paused until Play).
    const pause = showcase.getByRole("button", { name: "Pause service rotation" });
    if (await pause.isVisible()) {
      await pause.click();
      await expect(showcase.getByRole("button", { name: "Play service rotation" })).toBeVisible();
    }
    await showcase.getByRole("button", { name: `Show ${titles[0]}` }).click();
    await expect(showcase.locator("h2")).toHaveText(titles[0]!);
    await showcase.getByRole("button", { name: "Next service" }).click();
    await expect(showcase.locator("h2")).toHaveText(titles[1]!);
    await showcase.getByRole("button", { name: `Show ${titles[4]}` }).click();
    await expect(showcase.locator("h2")).toHaveText(titles[4]!);
    await expect(showcase.locator("button[aria-current='true']")).toHaveCount(1);
    await showcase.getByRole("button", { name: "Previous service" }).click();
    await expect(showcase.locator("h2")).toHaveText(titles[3]!);
    for (let i = 0; i < 6; i++) {
      await expect(cards.nth(i).locator("h3 a")).toHaveAttribute("href", `/services/${slugs[i]}/`);
      const wa = cards.nth(i).locator("a[href^='https://wa.me/94712259699?text=']");
      const text = new URL((await wa.getAttribute("href"))!).searchParams.get("text");
      expect(text).toBe(`Hello Pathirana Hardware, I would like to enquire about ${titles[i]}.`);
    }
    await expect(page.locator("main a[href='tel:+94712259699']").first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      /free delivery|same[- ]day|guaranteed|wholesale price|minimum order|discount/i,
    );
    await expect(page.locator("#home-site-delivery")).toBeVisible();
  });
});
