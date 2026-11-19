import { test as base } from "@playwright/test";
import { brandLogos, productCategories } from "../../src/content/products";

export * from "@playwright/test";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

/** TEST answers mirroring the client-documented catalogue as ACTIVE live data (API shapes). */
export const MOCK_CATEGORIES = productCategories.map((c, i) => ({
  slug: c.id,
  name: c.title,
  description: c.summary,
  productCount: 0,
  image: null,
  sortOrder: i,
}));
const BRAND_SLUG: Record<string, string> = {
  "PE+": "pe-plus",
  Swisstek: "swisstek",
  "El Toro": "el-toro",
  Würth: "wurth",
};
export const MOCK_BRANDS = brandLogos.map((l) => ({ slug: BRAND_SLUG[l.brand]!, name: l.brand, logo: null }));

/**
 * Deterministic category / brand lists for every test of an API build: the
 * pages show ONLY the live lists from the API, so without this the results
 * would depend on whatever a real local database holds. By default the API
 * answers with the documented categories and brands as active entries (a
 * set-up catalogue). Tests that need other answers register their own routes,
 * which take precedence (Playwright runs the latest matching route first).
 */
export const test = base.extend<{ taxonomyDefaults: void }>({
  taxonomyDefaults: [
    async ({ page }, use) => {
      if (API) {
        await page.route(`${API}/api/v1/categories`, (r) => r.fulfill({ json: { items: MOCK_CATEGORIES } }));
        await page.route(`${API}/api/v1/brands`, (r) => r.fulfill({ json: { items: MOCK_BRANDS } }));
      }
      await use();
    },
    { auto: true },
  ],
});
