import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "./fixtures";

/**
 * Layout audit (opt-in: LAYOUT_AUDIT=1). For every page × language × viewport it records:
 *  - page-wide horizontal overflow and the exact elements that stick out of the viewport
 *    (ignoring content inside its own scroll / clip container, e.g. a carousel track);
 *  - text clipped inside a box (overflow hidden/clip with content larger than the box).
 * Results: D:/.tmp/layout-audit/<lang>-<viewport>.json (+ a summary on failure).
 * Pages and widths can be narrowed with AUDIT_PAGES / AUDIT_WIDTHS (comma-separated).
 */
test.skip(!process.env.LAYOUT_AUDIT, "opt-in layout audit (LAYOUT_AUDIT=1)");
test.skip(({ isMobile }) => isMobile, "viewports are set explicitly");

const ALL_PAGES = [
  "/",
  "/about/",
  "/contact/",
  "/faq/",
  "/gallery/",
  "/quotation/",
  "/products/",
  "/products/category/?slug=building-materials",
  "/services/",
  "/services/all/",
  "/services/building-material-supply/",
  "/services/home-site-delivery/",
  "/services/contractor-support/",
];
const PAGES = process.env.AUDIT_PAGES ? process.env.AUDIT_PAGES.split(",") : ALL_PAGES;
const VIEWPORTS = [
  [320, 640],
  [360, 780],
  [375, 812],
  [390, 844],
  [430, 932],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  // landscape phones / tablets
  [844, 390],
  [932, 430],
  [1180, 820],
] as const;
const WIDTHS = process.env.AUDIT_WIDTHS?.split(",").map(Number);
const LANGS = (process.env.AUDIT_LANGS ?? "en,ta,si").split(",");
const OUT = "D:/.tmp/layout-audit";
mkdirSync(OUT, { recursive: true });

type Finding = { page: string; overflow: number; outside: string[]; clipped: string[] };

for (const lang of LANGS) {
  for (const [w, h] of VIEWPORTS.filter(([vw]) => !WIDTHS || WIDTHS.includes(vw))) {
    test(`${lang} ${w}×${h}`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.addInitScript((l) => window.localStorage.setItem("ph-lang", l), lang);
      await page.setViewportSize({ width: w, height: h });
      const findings: Finding[] = [];
      for (const path of PAGES) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        // Let reveal animations settle so measurements reflect the resting layout.
        await page.evaluate(async () => {
          document.querySelectorAll(".rv,.reveal").forEach((e) => e.classList.add("in", "is-visible"));
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((r) => setTimeout(r, 300));
          window.scrollTo(0, 0);
          await new Promise((r) => setTimeout(r, 300));
        });
        const f = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const name = (el: Element) => {
            const c = String((el as HTMLElement).className || "")
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 4)
              .join(".");
            const t = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
            return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${c ? "." + c : ""}${t ? ` "${t}"` : ""}`;
          };
          const clippedByAncestor = (el: Element) => {
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const o = getComputedStyle(p).overflowX;
              if (o !== "visible") return true;
            }
            return false;
          };
          const visible = (el: Element) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0;
          };
          const all = [...document.querySelectorAll("body *")];
          const outside = all
            .filter((el) => {
              if (!visible(el) || el.closest("[aria-hidden='true'],svg,canvas")) return false;
              const r = el.getBoundingClientRect();
              if (r.right <= vw + 1 && r.left >= -1) return false;
              return !clippedByAncestor(el);
            })
            // keep the outermost offenders only
            .filter((el, _i, arr) => !arr.some((o) => o !== el && o.contains(el)))
            .slice(0, 6)
            .map((el) => {
              const r = el.getBoundingClientRect();
              return `${name(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`;
            });
          const clipped = all
            .filter((el) => {
              if (!visible(el)) return false;
              if (!/^(H[1-6]|P|A|BUTTON|SPAN|LI|LABEL|DT|DD|FIGCAPTION|SUMMARY)$/.test(el.tagName)) return false;
              if (!(el.textContent ?? "").trim()) return false;
              const s = getComputedStyle(el);
              if (s.position === "absolute" && el.closest(".sr-only")) return false;
              if (el.closest(".sr-only,[aria-hidden='true']")) return false;
              // Visually hidden on purpose (e.g. sm:sr-only): a 1×1 box for screen readers.
              if (el.clientWidth <= 1 && el.clientHeight <= 1) return false;
              const hidesX = s.overflowX !== "visible";
              const hidesY = s.overflowY !== "visible";
              const overX = el.scrollWidth > el.clientWidth + 2;
              const overY = el.scrollHeight > el.clientHeight + 2;
              // line-clamp is an intentional truncation
              if (s.webkitLineClamp && s.webkitLineClamp !== "none") return false;
              if (s.textOverflow === "ellipsis") return false;
              return (hidesX && overX) || (hidesY && overY);
            })
            .slice(0, 6)
            .map((el) => `${name(el)} [${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight}]`);
          // Text laid over images: absolutely positioned labels inside one card must not overlap
          // (e.g. a long caption climbing into the "Illustration" badge).
          const overlaps: string[] = [];
          const labels = all.filter((el) => {
            if (!visible(el) || el.closest(".sr-only")) return false;
            if (getComputedStyle(el).position !== "absolute") return false;
            return [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
          });
          for (let i = 0; i < labels.length; i++)
            for (let j = i + 1; j < labels.length; j++) {
              const a = labels[i]!;
              const b = labels[j]!;
              if (a.parentElement !== b.parentElement) continue;
              const ra = a.getBoundingClientRect();
              const rb = b.getBoundingClientRect();
              const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
              const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
              if (x > 2 && y > 2 && overlaps.length < 4) overlaps.push(`${name(a)} ⟂ ${name(b)}`);
            }
          return { overflow: document.documentElement.scrollWidth - vw, outside, clipped: [...clipped, ...overlaps] };
        });
        if (f.overflow > 0 || f.outside.length || f.clipped.length) findings.push({ page: path, ...f });
      }
      writeFileSync(`${OUT}/${lang}-${w}x${h}.json`, JSON.stringify(findings, null, 2));
      expect(
        findings.map(
          (x) => `${x.page}: +${x.overflow}px | ${x.outside.join(" ; ")} | clipped: ${x.clipped.join(" ; ")}`,
        ),
      ).toEqual([]);
    });
  }
}
