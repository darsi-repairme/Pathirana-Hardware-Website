import { expect, test, type Page } from "./fixtures";
import { trackErrors } from "./helpers";

/**
 * Home › delivery-area section.
 * • Without NEXT_PUBLIC_API_URL (default build): the checker still works and
 *   answers honestly ("Please confirm delivery with our team").
 * • With it (build and test run with the same NEXT_PUBLIC_API_URL): API
 *   responses are mocked with the backend's real shapes — the names below are
 *   test data only, never shown on the live site.
 */
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
const section = (page: Page) => page.locator("section[data-delivery-state]");
const waText = async (page: Page) =>
  new URL(
    (await section(page)
      .getByRole("link", { name: /on WhatsApp/ })
      .getAttribute("href"))!,
  ).searchParams.get("text");

async function openHome(page: Page) {
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
}

async function check(page: Page, area: string) {
  const s = section(page);
  await s.getByLabel("Your town, area or postal code").fill(area);
  await s.getByRole("button", { name: "Check Availability" }).click();
}

test.describe("Home delivery areas", () => {
  // The homepage runs several WebGL scenes, software-rendered in headless Chromium. Under parallel
  // load, loading them and then closing the page could exceed the default 30 s ("Tearing down
  // context exceeded the test timeout"). Same budget as the other homepage tests (the page is
  // released before teardown in fixtures.ts).
  test.describe.configure({ timeout: 60_000 });

  test("search is always available; without an API the answer is honest", async ({ page }) => {
    test.skip(Boolean(API), "build has an API configured");
    const errors = trackErrors(page);
    await openHome(page);
    const s = section(page);
    await expect(s.getByRole("heading", { level: 2 })).toHaveText("Do We Deliver to Your Area?");
    await expect(s.getByLabel("Your town, area or postal code")).toBeVisible();
    await expect(s.getByRole("button", { name: "Check Availability" })).toBeVisible();

    await check(page, "Bangadeniya");
    await expect(s).toContainText("Please confirm delivery with our team.");
    await expect(s).not.toContainText(/Yes — we deliver/);
    expect(await waText(page)).toBe("Hello Pathirana Hardware, I would like to enquire about delivery to Bangadeniya.");
    expect(errors).toEqual([]);
  });

  test("truck drives the route, wheels turn, pin bounces, loop restarts", async ({ page }) => {
    await openHome(page);
    const svg = section(page).locator("svg.delivery-art");
    await expect(svg).toHaveAttribute("data-animated", "true");
    // Sample the SMIL timeline at fixed times (paused, so the checks are deterministic).
    const sample = (t: number) =>
      svg.evaluate((el: SVGSVGElement, time) => {
        el.pauseAnimations();
        el.setCurrentTime(time);
        const truck = el.querySelector("animateMotion")!.parentElement as unknown as SVGGraphicsElement;
        const wheel = el.querySelector("animateTransform[type='rotate']")!.parentElement as unknown as SVGGElement;
        const pin = el.querySelector("animateTransform[type='translate']")!.parentElement as unknown as SVGGElement;
        const m = truck.getCTM()!;
        const rot = wheel.transform.animVal[0]?.angle ?? 0;
        const pinY = pin.transform.animVal[0]?.matrix.f ?? 0;
        return { x: m.e, y: m.f, heading: (Math.atan2(m.b, m.a) * 180) / Math.PI, rot, pinY };
      }, t);

    const start = await sample(0.5);
    const mid = await sample(3.2);
    const arrived = await sample(5.6);
    const bounce = await sample(5.8);
    const pause = await sample(7);
    const restarted = await sample(8.5);

    expect(mid.x).toBeGreaterThan(start.x + 40); // the truck itself moves along the route
    expect(arrived.x).toBeGreaterThan(mid.x + 40);
    expect(Math.abs(mid.heading - start.heading)).toBeGreaterThan(5); // orientation follows the curve
    expect(Math.abs(mid.rot - start.rot)).toBeGreaterThan(360); // wheels rotate while driving
    expect(pause.x).toBeCloseTo(arrived.x, 0); // stopped at the destination
    expect(bounce.pinY).toBeLessThan(-3); // pin bounces on arrival
    expect(Math.abs(start.pinY)).toBeLessThan(0.01);
    expect(restarted.x).toBeCloseTo(start.x, 0); // clean restart
  });

  test.describe("with the API", () => {
    test.skip(!API, "build without NEXT_PUBLIC_API_URL");

    test("no areas listed → honest unconfirmed result, search still shown", async ({ page }) => {
      await page.route(`${API}/api/v1/delivery-areas`, (r) => r.fulfill({ json: { items: [], total: 0 } }));
      await page.route(`${API}/api/v1/delivery-areas/check?**`, (r) =>
        r.fulfill({ json: { query: "Somewhere", supported: false, area: null, areasListed: false } }),
      );
      await openHome(page);
      await expect(section(page)).toHaveAttribute("data-delivery-state", "none");
      await check(page, "Somewhere");
      await expect(section(page)).toContainText("Please confirm delivery with our team.");
      expect(await waText(page)).toContain("delivery to Somewhere");
    });

    test("API unavailable → search still shown, never claims coverage", async ({ page }) => {
      await page.route(`${API}/api/v1/delivery-areas**`, (r) => r.fulfill({ status: 503, json: {} }));
      await openHome(page);
      await expect(section(page)).toHaveAttribute("data-delivery-state", "none");
      await check(page, "Test Town");
      await expect(section(page)).toContainText("Please confirm delivery with our team.");
      await expect(section(page)).not.toContainText(/Yes — we deliver/);
    });

    test("approved areas: supported and unsupported results from the backend", async ({ page }) => {
      const area = {
        id: "a1",
        name: "Test Town",
        district: "Test District",
        postalCode: "12345",
        notes: null,
        // Even when staff record a fee, the public website never shows delivery charges.
        feeLkr: 350,
      };
      await page.route(`${API}/api/v1/delivery-areas`, (r) => r.fulfill({ json: { items: [area], total: 1 } }));
      await page.route(`${API}/api/v1/delivery-areas/check?**`, (r) => {
        const q = new URL(r.request().url()).searchParams.get("area")!;
        const yes = q.toLowerCase() === "test town";
        return r.fulfill({ json: { query: q, supported: yes, area: yes ? area : null, areasListed: true } });
      });
      await openHome(page);
      const s = section(page);
      await expect(s).toHaveAttribute("data-delivery-state", "ready");
      await expect(s.locator("datalist option")).toHaveCount(1);

      await check(page, "Test Town");
      await expect(s).toContainText("Yes — we deliver to Test Town, Test District.");
      await expect(s).not.toContainText(/Delivery fee|LKR|350/); // never shown publicly
      expect(await waText(page)).toBe(
        "Hello Pathirana Hardware, I would like to enquire about delivery to Test Town, Test District.",
      );

      await check(page, "Elsewhere");
      await expect(s).toContainText("“Elsewhere” is not on our listed delivery areas yet.");
      expect(await waText(page)).toContain("delivery to Elsewhere");
    });
  });
});
