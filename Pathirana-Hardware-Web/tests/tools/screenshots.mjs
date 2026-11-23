/**
 * Captures full-page screenshots of every page at several widths for visual
 * review. Requires the static server to be running (npm start).
 *
 * Usage: node tests/tools/screenshots.mjs [baseUrl] [widths]
 *   e.g. node tests/tools/screenshots.mjs http://127.0.0.1:4173 390,1440
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:4173";
const widths = (process.argv[3] || "320,390,768,1024,1440,1920").split(",").map(Number);
const pages = ["/", "/products/", "/about/", "/services/", "/gallery/", "/contact/", "/missing-page/"];
const outDir = "test-results/screens";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    // Scroll through the page so lazy-loaded images load before the capture.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle");
    const name = (p === "/" ? "home" : p.replace(/\//g, "")) + `-${width}.png`;
    await page.screenshot({ path: `${outDir}/${name}`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${width}px ${p} → ${name}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ""}`);
  }
  await ctx.close();
}
await browser.close();
