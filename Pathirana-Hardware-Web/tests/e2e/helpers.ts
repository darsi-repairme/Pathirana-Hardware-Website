import { expect, type Page } from "@playwright/test";

export const PAGES = [
  { path: "/", h1: /Your Trusted Partner for Building & Hardware Needs/ },
  { path: "/products/", h1: /Our Products/ },
  { path: "/products/categories/steel-products/", h1: /Steel Products/ },
  { path: "/products/plywood/", h1: /Plywood/ },
  { path: "/about/", h1: /Our Story/ },
  { path: "/services/", h1: /Our Services/ },
  { path: "/services/home-site-delivery/", h1: /Home \/ Site Delivery/ },
  { path: "/gallery/", h1: /Inside Pathirana Hardware/ },
  { path: "/contact/", h1: /Get in Touch/ },
  { path: "/faq/", h1: /Frequently asked questions/ },
  { path: "/quotation/", h1: /Request a Quotation/ },
] as const;

/** Collects console errors, page errors and CSP violations during a test. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Asserts every <img> on the page has loaded successfully. */
export async function expectNoBrokenImages(page: Page) {
  // Bring lazy images into view.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
  });
  const broken = await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    // A lazy image scrolled past too quickly may never start loading; load it now.
    for (const img of imgs) if (!img.complete) img.loading = "eager";
    await Promise.all(imgs.map((img) => (img.complete ? null : img.decode().catch(() => null))));
    return imgs.filter((img) => img.naturalWidth === 0).map((img) => img.currentSrc || img.src);
  });
  expect(broken, `broken images: ${broken.join(", ")}`).toEqual([]);
}
