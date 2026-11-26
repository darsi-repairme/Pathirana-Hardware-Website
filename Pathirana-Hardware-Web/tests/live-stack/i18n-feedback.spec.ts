import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ADMIN } from "./global-setup";
import { LIVE_API_PORT } from "./ports.mjs";

/**
 * REAL end-to-end for the multilingual site and customer feedback: website
 * (static build) → website API → throwaway PostgreSQL. All names, messages
 * and translations are TEST data in the throwaway database only.
 */
const API = `http://127.0.0.1:${LIVE_API_PORT}`;

let api: APIRequestContext;
test.beforeAll(async ({ playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: API });
  const login = await anon.post("/api/v1/auth/login", { data: ADMIN });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  await anon.dispose();
  api = await playwright.request.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });
});
test.afterAll(async () => api?.dispose());

async function call(method: "get" | "post" | "patch", url: string, data?: object) {
  const res = await api[method](url, data ? { data } : {});
  expect(res.ok(), `${method} ${url} → ${res.status()} ${await res.text()}`).toBe(true);
  return res.json();
}

/** Chooses a language with the visible selector (desktop menu, or the mobile drawer). */
async function chooseLanguage(page: Page, native: string, mobile: boolean) {
  if (mobile) {
    await page.getByRole("button", { name: /Open menu|பட்டியலைத் திறக்கவும்|මෙනුව විවෘත කරන්න/ }).click();
    await page
      .locator("#mobile-menu")
      .getByRole("button", { name: new RegExp(`^${native}`) })
      .click();
    await page.keyboard.press("Escape");
  } else {
    await page
      .locator("header")
      .getByRole("button", { name: /Language|மொழி|භාෂාව/ })
      .click();
    await page
      .locator("header")
      .getByRole("button", { name: new RegExp(`^${native}`) })
      .click();
  }
}

test("language switch: instant, remembered across pages and refresh, URL unchanged", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  await page.goto("/services/");
  await expect(page.locator("h1")).toContainText("Our Services");
  await chooseLanguage(page, "தமிழ்", mobile);
  await expect(page.locator("h1")).toContainText("எமது சேவைகள்");
  await expect(page.locator("html")).toHaveAttribute("lang", "ta-LK");
  expect(new URL(page.url()).pathname).toBe("/services/");
  await page.reload();
  await expect(page.locator("h1")).toContainText("எமது சேவைகள்");
  await page.goto("/contact/");
  await expect(page.locator("h1")).toContainText("தொடர்பு கொள்ளுங்கள்");
  await chooseLanguage(page, "සිංහල", mobile);
  await expect(page.locator("h1")).toContainText("අප හා සම්බන්ධ වන්න");
  await chooseLanguage(page, "English", mobile);
  await expect(page.locator("h1")).toContainText("Get in Touch");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-LK");
});

test("dynamic product translations, fallback to English, and the Sinhala WhatsApp enquiry", async ({ page }, info) => {
  const t = info.project.name === "mobile" ? "m" : "d";
  const category = await call("post", "/api/v1/admin/categories", {
    name: `I18n Test Category ${t}`,
    translations: { si: { name: "පරීක්ෂණ කාණ්ඩය" } },
  });
  const product = await call("post", "/api/v1/admin/products", {
    name: `I18n Test Product ${t}`,
    slug: `i18n-test-product-${t}`,
    categoryId: category.id,
    summary: "English summary only",
    priceLkr: "2500.00",
    contactForPrice: false,
    unit: "bag",
    availability: "available",
    translations: { si: { name: `පරීක්ෂණ නිෂ්පාදනය ${t}` } },
  });
  await call("patch", `/api/v1/admin/products/${product.id}/publication`, { published: true });

  await page.addInitScript(() => localStorage.setItem("ph-lang", "si"));
  await page.goto(`/products/item/?slug=i18n-test-product-${t}`);
  await expect(page.locator("h1")).toHaveText(`පරීක්ෂණ නිෂ්පාදනය ${t}`);
  // No Sinhala summary was entered → the real English summary is shown (never a key or blank).
  await expect(page.getByText("English summary only")).toBeVisible();
  await expect(page.getByText("LKR 2,500.00")).toBeVisible();
  const href = await page
    .getByRole("link", { name: /WhatsApp හරහා විමසන්න/ })
    .first()
    .getAttribute("href");
  const text = new URL(href!).searchParams.get("text")!;
  expect(text).toContain("ආයුබෝවන් Pathirana Hardware,");
  expect(text).toContain(`පරීක්ෂණ නිෂ්පාදනය ${t}`);
  expect(text).toContain("LKR 2,500.00 / bag");
  expect(text).toContain("[ප්‍රමාණය ඇතුළත් කරන්න]");
  expect(new URL(href!).hostname).toBe("wa.me");

  // Tamil has no translation for this product → English name.
  await page.evaluate(() => localStorage.setItem("ph-lang", "ta"));
  await page.addInitScript(() => localStorage.setItem("ph-lang", "ta"));
  await page.reload();
  await expect(page.locator("h1")).toHaveText(`I18n Test Product ${t}`);

  // Clean up: other tests in this throwaway database expect no active test categories.
  await call("patch", `/api/v1/admin/products/${product.id}/publication`, { published: false });
  await call("patch", `/api/v1/admin/categories/${category.id}/status`, { isActive: false });
});

test("customer feedback: validation, pending until approved, approved shown in its original language, hidden removed", async ({
  page,
}, info) => {
  const mobile = info.project.name === "mobile";
  const name = `Test Reviewer ${mobile ? "M" : "D"}`;
  const message = "மிகவும் நல்ல சேவை. இது ஒரு சோதனைச் செய்தி மட்டுமே.";
  await page.addInitScript(() => localStorage.setItem("ph-lang", "ta"));
  await page.goto("/");
  const section = page.locator("[data-testimonials]");
  await section.scrollIntoViewIfNeeded();
  await section.getByRole("button", { name: "உங்கள் கருத்தைப் பகிருங்கள்" }).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();

  // Required-field validation, in Tamil, before anything is sent.
  await dialog.getByRole("button", { name: "கருத்தைச் சமர்ப்பி" }).click();
  await expect(dialog).toContainText("உங்கள் பெயரை உள்ளிடவும்.");
  await expect(dialog).toContainText("1 முதல் 5 நட்சத்திரங்கள் வரை ஒரு மதிப்பீட்டைத் தேர்ந்தெடுக்கவும்.");
  await expect(dialog).toContainText("சமர்ப்பிக்கும் முன் ஒப்புக்கொள்ளும் பெட்டியைத் தேர்வு செய்யவும்.");

  await dialog.getByLabel(/உங்கள் பெயர்/).fill(name);
  await dialog.getByRole("radio", { name: /5 இல் 5 நட்சத்திரங்கள்/ }).check({ force: true });
  await dialog.getByLabel(/உங்கள் கருத்து/).fill(message);
  await dialog.getByLabel(/உங்கள் ஊர்/).fill("Test Town");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "கருத்தைச் சமர்ப்பி" }).click();
  await expect(dialog).toContainText("உங்கள் கருத்துக்கு நன்றி!");

  // Saved as pending; not public.
  const list = await call("get", "/api/v1/admin/feedback?status=pending");
  const row = list.items.find((i: { name: string }) => i.name === name);
  expect(row).toMatchObject({ status: "pending", language: "ta", rating: 5, message });
  const publicNames = async () =>
    ((await (await api.get("/api/v1/feedback")).json()).items as { name: string }[]).map((i) => i.name);
  expect(await publicNames()).not.toContain(name);

  // Approved → shown exactly as written, in Tamil; in English the original language is labelled.
  await call("post", `/api/v1/admin/feedback/${row.id}/approve`, {});
  await page.evaluate(() => localStorage.setItem("ph-lang", "en"));
  await page.addInitScript(() => localStorage.setItem("ph-lang", "en"));
  await page.reload();
  await section.scrollIntoViewIfNeeded();
  await expect(section).toContainText(message);
  await expect(section).toContainText(name);
  await expect(section).toContainText("Written in Tamil by the customer");
  await expect(section.locator("blockquote")).toHaveAttribute("lang", "ta-LK");

  // Hidden → removed from the website.
  await call("post", `/api/v1/admin/feedback/${row.id}/hide`, {});
  await page.reload();
  await section.scrollIntoViewIfNeeded();
  await expect(section).not.toContainText(message);
});
