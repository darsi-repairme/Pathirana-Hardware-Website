/**
 * Language SWITCH audit (manual tool, not part of CI):
 *   node tests/tools/i18n-switch-audit.mjs [baseUrl] [ta|si] [width]
 * Loads each page in English, switches language with the real header control, then lists
 * visible text that is still English (runs of 3+ Latin words), excluding names, brands,
 * numbers, emails and URLs. Also checks the URL did not change (no redirect to Home).
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const locale = process.argv[3] ?? "ta";
const width = Number(process.argv[4] ?? 1280);
const pages = [
  "/",
  "/products/",
  "/products/categories/cement-building-materials/",
  "/no-such-page/",
  "/products/categories/steel-products/",
  "/products/cement/",
  "/services/",
  "/services/home-site-delivery/",
  "/services/contractor-support/",
  "/gallery/",
  "/about/",
  "/contact/",
  "/quotation/",
  "/faq/",
];
const ALLOW = [
  /Pathirana Hardware/g,
  /\(Pvt\) Ltd\.?/gi,
  /RepairMe \(Pvt\) Ltd\.?/g,
  /PE\+|Swisstek|El Toro|Würth|UltraTech|Ultratech|WhatsApp|Facebook|Instagram|LinkedIn|TikTok|Google Maps/g,
  /\S+@\S+/g,
  /https?:\/\/\S+/g,
  /LKR [\d,.]+/g,
  /TOR|JPEG|PNG|WebP|MB/g,
];
const NATIVE = { ta: "தமிழ்", si: "සිංහල" };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: 900 } });
await ctx.addInitScript(() => {
  if (!sessionStorage.getItem("ph-audit-init")) {
    localStorage.removeItem("ph-lang");
    sessionStorage.setItem("ph-audit-init", "1");
  }
});
const page = await ctx.newPage();
let total = 0;
for (const path of pages) {
  await page.evaluate(() => localStorage.removeItem("ph-lang")).catch(() => {});
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(800);
  const before = page.url();
  // Switch with the real control: desktop header button, or the menu drawer below lg.
  const desktopBtn = page.locator("header [data-lang-button]:visible");
  if (await desktopBtn.count()) {
    await desktopBtn.first().click();
    await page.getByRole("menuitemradio", { name: NATIVE[locale] }).click();
  } else {
    await page.getByRole("button", { name: /menu/i }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: NATIVE[locale] }).click();
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(1500);
  const texts = await page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.parentElement;
      if (!el || el.closest("script,style,noscript,svg,[aria-hidden=true],blockquote,[data-no-i18n],[hidden]"))
        continue;
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t) out.push(t);
    }
    for (const el of document.querySelectorAll("[placeholder],[aria-label],img[alt]"))
      for (const a of ["placeholder", "aria-label", "alt"]) if (el.getAttribute(a)) out.push(el.getAttribute(a));
    out.push(document.title);
    return out;
  });
  const english = [
    ...new Set(
      texts.filter((t) => {
        let s = t;
        for (const re of ALLOW) s = s.replace(re, " ");
        return /([A-Za-z]{2,}[\s,.'’-]+){2,}[A-Za-z]{2,}/.test(s);
      }),
    ),
  ];
  total += english.length;
  const moved = page.url() !== before ? `  ⚠ URL changed → ${page.url()}` : "";
  console.log(`\n${path} — ${english.length} English strings after switching${moved}`);
  for (const e of english) console.log(`   • ${e.slice(0, 150)}`);
}
console.log(`\nTOTAL ${total}`);
await browser.close();
