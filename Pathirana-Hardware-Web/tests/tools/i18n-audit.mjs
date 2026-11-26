/**
 * Translation coverage audit (manual tool, not part of CI):
 *   node tests/tools/i18n-audit.mjs [baseUrl] [ta|si]
 * Opens each main page with the language chosen and lists visible text that is
 * still English (runs of 3+ Latin words), excluding proper names, brands, phone
 * numbers, emails and URLs. Customer reviews and staff-entered names are expected
 * to stay as written.
 */
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
const locale = process.argv[3] ?? "ta";
const pages = [
  "/",
  "/products/",
  "/products/cement/",
  "/products/categories/steel-products/",
  "/products/categories/branded-hardware/",
  "/services/",
  "/services/home-site-delivery/",
  "/about/",
  "/contact/",
  "/quotation/",
  "/faq/",
];
const ALLOW = [
  /Pathirana Hardware/g,
  /\(Pvt\) Ltd\.?/gi,
  /Oshada Warshan Pathirana/g,
  /RepairMe \(Pvt\) Ltd\./g,
  /PE\+|Swisstek|El Toro|Würth|UltraTech|WhatsApp|Facebook|Instagram|LinkedIn|TikTok|Google Maps/g,
  /\S+@\S+/g,
  /https?:\/\/\S+/g,
  /LKR [\d,.]+/g,
  /TOR|JPEG|PNG|WebP|MB/g,
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript((l) => localStorage.setItem("ph-lang", l), locale);
const page = await ctx.newPage();
let total = 0;
for (const path of pages) {
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  // Open the feedback dialog on Home so its text is audited too (only when the API is configured).
  const texts = await page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.parentElement;
      if (!el || el.closest("script,style,noscript,svg,[aria-hidden=true],blockquote,[data-no-i18n]")) continue;
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (t) out.push(t);
    }
    for (const el of document.querySelectorAll("[placeholder],[aria-label],img[alt]")) {
      for (const a of ["placeholder", "aria-label", "alt"]) if (el.getAttribute(a)) out.push(el.getAttribute(a));
    }
    out.push(document.title, document.documentElement.lang);
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
  console.log(`\n${path} — ${english.length} English strings`);
  for (const e of english) console.log(`   • ${e.slice(0, 160)}`);
}
console.log(`\nTOTAL ${total}`);
await browser.close();
