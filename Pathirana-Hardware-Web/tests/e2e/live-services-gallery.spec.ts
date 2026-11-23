import { expect, MOCK_SERVICES, test } from "./fixtures";
import { trackErrors } from "./helpers";

/**
 * Services and Gallery managed in the Admin (API build). Responses are mocked in the API's real
 * shapes; every changed text, name and photo here is TEST data.
 */
const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
test.skip(!API, "build without NEXT_PUBLIC_API_URL (bundled services only)");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqP9fDwAEhgGAWw5cIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Live services", () => {
  test("staff edits, order and hiding reach the Services page, Home ring and footer", async ({ page }) => {
    const errors = trackErrors(page);
    // Staff: edited the delivery summary, hid "bulk-orders", moved contractor support first.
    const edited = MOCK_SERVICES.filter((s) => s.slug !== "bulk-orders").map((s) =>
      s.slug === "home-site-delivery"
        ? { ...s, summary: "Test summary from the Admin.", description: "Test description from the Admin." }
        : s,
    );
    const contractor = edited.find((s) => s.slug === "contractor-support")!;
    const items = [contractor, ...edited.filter((s) => s !== contractor)];
    await page.route(`${API}/api/v1/services`, (r) => r.fulfill({ json: { items } }));

    await page.goto("/services/");
    const list = page.locator("[data-services-list]");
    await expect(list.locator("li")).toHaveCount(5);
    await expect(list.locator("li").first()).toHaveAttribute("id", "contractor-support");
    await expect(list.locator("li#home-site-delivery")).toContainText("Test description from the Admin.");
    await expect(list.locator("li#bulk-orders")).toHaveCount(0);
    // The circular showcase follows: five markers, counter "/ 05".
    await expect(page.locator(".services-orbit-node")).toHaveCount(5);
    await expect(page.locator("[data-slide-counter]").first()).toContainText("/ 05");
    // Footer: the published services only (loaded once the footer comes into view).
    const footer = page.getByRole("navigation", { name: "Our services" });
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link")).toHaveCount(5);

    await page.goto("/");
    await expect(page.locator(".services-ring-card")).toHaveCount(5);
    await expect(page.locator(".services-ring-card", { hasText: "Test summary from the Admin." })).toHaveCount(1);

    // The hidden service's pre-built page says so instead of presenting it as offered.
    await page.goto("/services/bulk-orders/");
    await expect(page.locator("[data-service-hidden]")).toBeVisible();
    // An edited service's page shows the staff text.
    await page.goto("/services/home-site-delivery/");
    await expect(page.getByText("Test description from the Admin.").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("API unavailable: the approved six stay on the page (no empty layout)", async ({ page }) => {
    await page.route(`${API}/api/v1/services`, (r) => r.abort("internetdisconnected"));
    await page.goto("/services/");
    await expect(page.locator("[data-services-list] li")).toHaveCount(6);
    await expect(page.locator(".services-orbit-node")).toHaveCount(6);
  });
});

test.describe("See More: all services with photos", () => {
  // TEST data: a service added in the Admin (no 3D scene, no pre-built page) and a photo for one of the six.
  const added = {
    ...MOCK_SERVICES[0]!,
    slug: "test-tool-hire",
    title: "Test Tool Hire",
    shortTitle: "Test Tool Hire",
    summary: "Test summary for an added service.",
    description: "Test description for an added service.",
    howToAsk: "Test how-to-ask text.",
    sortOrder: 999,
    image: {
      url: "/api/v1/service-images/test?size=full",
      thumbUrl: "/api/v1/service-images/test?size=thumb",
      width: 1,
      height: 1,
      alt: "Test photo of tool hire",
    },
  };
  const withPhoto = MOCK_SERVICES.map((s) =>
    s.slug === "bulk-orders" ? { ...s, image: { ...added.image, alt: "Test photo of bulk orders" } } : s,
  );

  test("the six plus every newly published service appear as image cards; 3D sections keep the six", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.route(`${API}/api/v1/services`, (r) => r.fulfill({ json: { items: [...withPhoto, added] } }));
    await page.route(`${API}/api/v1/service-images/**`, (r) => r.fulfill({ contentType: "image/png", body: PNG }));

    // Home: the 3D ring stays the approved six; See More leads to the image page.
    await page.goto("/");
    await expect(page.locator(".services-ring-card")).toHaveCount(6);
    await expect(page.locator(".services-ring-card", { hasText: "Test Tool Hire" })).toHaveCount(0);
    await page.locator("[data-see-more] a").click();
    // Headless Chromium renders the Home WebGL scenes in software, so the client navigation can be slow.
    await expect(page).toHaveURL(/\/services\/all\/$/, { timeout: 15_000 });

    const cards = page.locator("[data-service-card]");
    await expect(cards).toHaveCount(7);
    await expect(cards.last()).toHaveAttribute("id", "test-tool-hire");
    // Uploaded photos are used; a service without one gets the plain branded panel (no stand-in photo).
    await expect(page.locator("#bulk-orders img")).toHaveAttribute("alt", "Test photo of bulk orders");
    await expect(page.locator("#test-tool-hire img")).toHaveAttribute("alt", "Test photo of tool hire");
    await expect(page.locator("#home-site-delivery [data-image-fallback]")).toBeVisible();
    await expect(page.locator("#home-site-delivery img")).toHaveCount(0);
    // Further details and the WhatsApp action; an added service has no pre-built page to link to.
    const card = page.locator("#test-tool-hire");
    await card.getByText("More details").click();
    await expect(card.getByText("Test description for an added service.")).toBeVisible();
    await expect(card.getByRole("link", { name: /View service/ })).toHaveCount(0);
    await expect(card.getByRole("link", { name: /Enquire about Test Tool Hire on WhatsApp/ })).toHaveAttribute(
      "href",
      /wa\.me|whatsapp/,
    );
    await expect(page.locator("#bulk-orders").getByRole("link", { name: /View service/ })).toHaveAttribute(
      "href",
      "/services/bulk-orders/",
    );

    // Search filters the cards and recovers from no matches.
    const search = page.getByRole("searchbox", { name: "Search services" });
    await search.fill("tool hire");
    await expect(cards).toHaveCount(1);
    await search.fill("zzzz-no-match");
    await expect(cards).toHaveCount(0);
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await expect(cards).toHaveCount(7);

    // /services/: showcase and list keep the six; its See More goes to the same page.
    await page.goto("/services/");
    await expect(page.locator(".services-orbit-node")).toHaveCount(6);
    await expect(page.locator("[data-services-list] li")).toHaveCount(6);
    await expect(page.locator("[data-see-more] a")).toHaveAttribute("href", "/services/all/");
    expect(errors).toEqual([]);
  });

  test("a link to an added service opens its card once the live list arrives", async ({ page }) => {
    await page.route(`${API}/api/v1/services`, (r) => r.fulfill({ json: { items: [...MOCK_SERVICES, added] } }));
    await page.route(`${API}/api/v1/service-images/**`, (r) => r.fulfill({ contentType: "image/png", body: PNG }));
    await page.goto("/services/all/#test-tool-hire");
    const card = page.locator("#test-tool-hire");
    await expect(card).toBeInViewport();
    await expect(card.getByText("Test description for an added service.")).toBeVisible();
  });

  test("a service hidden in the Admin never appears, not even while the live list loads", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const items = MOCK_SERVICES.filter((s) => s.slug !== "bulk-orders");
    await page.route(`${API}/api/v1/services`, async (r) => {
      await gate;
      await r.fulfill({ json: { items } });
    });
    // The page as delivered (before any script runs) lists no service cards.
    const html = await (await page.request.get("/services/all/")).text();
    expect(html).not.toContain("data-service-card");
    await page.goto("/services/all/");
    await expect(page.getByRole("status")).toHaveText("Loading services…");
    await expect(page.locator("[data-service-card]")).toHaveCount(0);
    await expect(page.locator("#bulk-orders")).toHaveCount(0);
    release();
    await expect(page.locator("[data-services-status='live']")).toBeVisible();
    await expect(page.locator("[data-service-card]")).toHaveCount(5);
    await expect(page.locator("#bulk-orders")).toHaveCount(0);
  });

  test("API unavailable: the approved six still show as cards", async ({ page }) => {
    await page.route(`${API}/api/v1/services`, (r) => r.abort("internetdisconnected"));
    await page.goto("/services/all/");
    await expect(page.locator("[data-service-card]")).toHaveCount(6);
    await expect(page.locator("[data-image-fallback]")).toHaveCount(6);
  });
});

test.describe("Live gallery", () => {
  test("published Admin photos appear in the collage and open in the lightbox (keyboard)", async ({ page }) => {
    const errors = trackErrors(page);
    const photo = (id: string, title: string) => ({
      id,
      title,
      caption: `${title} caption`,
      altText: `${title} description`,
      collection: "Test Group",
      width: 1,
      height: 1,
      url: `/api/v1/gallery-images/${id}`,
      thumbUrl: `/api/v1/gallery-images/${id}?size=thumb`,
      translations: {},
    });
    const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
    await page.route(`${API}/api/v1/gallery`, (r) =>
      r.fulfill({ json: { items: [photo(ids[0]!, "Test Photo A"), photo(ids[1]!, "Test Photo B")] } }),
    );
    await page.route(`${API}/api/v1/gallery-images/**`, (r) => r.fulfill({ contentType: "image/png", body: PNG }));

    await page.goto("/gallery/");
    await expect(page.getByRole("button", { name: "Test Group" })).toBeVisible();
    await page.getByRole("button", { name: "Test Group" }).click();
    const tiles = page.getByRole("img", { name: /^Test Photo [AB] description$/ });
    await expect(tiles).toHaveCount(2);
    await tiles.first().click();
    const viewer = page.getByRole("dialog", { name: "Image viewer" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole("img", { name: "Test Photo A description" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByRole("img", { name: "Test Photo B description" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    expect(errors).toEqual([]);
  });
});
