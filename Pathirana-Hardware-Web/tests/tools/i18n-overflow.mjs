/**
 * Layout check for long Tamil / Sinhala text (manual tool):
 *   node tests/tools/i18n-overflow.mjs [baseUrl]
 * For each language × width × page: page-level horizontal scroll, and visible
 * buttons / links / headings whose text is clipped or wider than the viewport.
 */
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3000";
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];
const pages = ["/", "/products/", "/products/cement/", "/services/", "/about/", "/contact/", "/quotation/", "/faq/"];
const browser = await chromium.launch();
let problems = 0;
for (const locale of ["ta", "si", "en"]) {
  const ctx = await browser.newContext();
  await ctx.addInitScript((l) => localStorage.setItem("ph-lang", l), locale);
  const page = await ctx.newPage();
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const path of pages) {
      await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(700);
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const issues = [];
        if (document.documentElement.scrollWidth > vw + 1)
          issues.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
        for (const el of document.querySelectorAll("a, button, h1, h2, h3, label, legend")) {
          const s = getComputedStyle(el);
          if (
            s.visibility === "hidden" ||
            s.display === "none" ||
            el.closest("[hidden],dialog:not([open]),.sr-only,[aria-hidden=true]")
          )
            continue;
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          if (b.right > vw + 1 && s.position !== "fixed")
            issues.push(`beyond viewport: ${el.tagName} "${el.textContent.trim().slice(0, 50)}"`);
          if (
            (el.tagName === "A" || el.tagName === "BUTTON") &&
            el.scrollWidth > el.clientWidth + 2 &&
            s.overflow !== "visible" &&
            !/truncate/.test(el.className)
          )
            issues.push(`clipped: ${el.tagName} "${el.textContent.trim().slice(0, 50)}"`);
        }
        return [...new Set(issues)].slice(0, 6);
      });
      if (r.length) {
        problems += r.length;
        console.log(`${locale} ${w}px ${path}`);
        for (const i of r) console.log(`   • ${i}`);
      }
    }
  }
  await ctx.close();
}
console.log(`\nPROBLEMS ${problems}`);
await browser.close();
