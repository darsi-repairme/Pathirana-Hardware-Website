# Implementation report — Pathirana Hardware website

Date: 2026-11-11 · Environment: Windows 11, Node 24.20.0, npm 11.19.0

## 1. Completed features

- **Five pages**: Home `/`, About `/about/`, Services `/services/`, Gallery `/gallery/`, Contact `/contact/`, plus a
  designed 404 page, `sitemap.xml`, `robots.txt`, app icons and an Open Graph image.
- **Static export** (Next.js 16.4 App Router) suitable for any static host; no backend, database, forms, cookies
  or trackers.
- **Original logo** used unaltered (white margins trimmed only), in header, footer, About sections, icons and the
  social image.
- **Design system**: approved palette as Tailwind tokens, DM Serif Display + Inter, consistent spacing/type scale,
  reusable components (Button, SectionHeading, PageHero, Container, ContactCta, Logo), blueprint-grid / ruler /
  diagonal-bar industrial motifs, CSS-only hero composition (no photography, nothing presented as a real photo).
- **Navigation**: sticky header with scroll shadow, active-page underline, persistent call button, utility contact
  bar (desktop), native `<dialog>` mobile drawer (focus contained, Escape closes, focus returns), skip link.
- **Homepage sections A–H**: header, hero with official tagline and both CTAs, “What to expect” highlights, About
  preview, Hardware-focus/services preview, gallery preview (empty-state), forest-green contact CTA, footer.
- **Gallery**: responsive grid + accessible lightbox (keyboard arrows, Escape, swipe, focus return), polished
  empty state while no approved photos exist, photo pipeline (`npm run gallery`) that strips EXIF/GPS.
- **Contact**: working `tel:+94712259699`, `mailto:pathiranahardwarepvt@gmail.com`, Facebook link, Google Maps
  _address search_ (labelled as a search), “call to confirm opening times” instead of invented hours. WhatsApp,
  hours, coordinates appear automatically once filled in `business.ts`.
- **Motion**: CSS entrance animations, scroll-driven reveals (progressive enhancement), hover micro-interactions,
  dialog transitions; all disabled under `prefers-reduced-motion`; content never hidden without JS.
- **SEO**: unique titles/descriptions, Open Graph/Twitter tags, `HardwareStore` JSON-LD from verified data only,
  canonical/sitemap/OG URLs emitted only when `NEXT_PUBLIC_SITE_URL` is set, local keywords (Bangadeniya).
- **Security**: hash-based CSP and security headers generated per build for Netlify/Cloudflare (`_headers`) and
  Apache (`.htaccess`), pinned dependencies, safe external links.

## 2. Tests actually executed (final run)

| Check                                   | Command                                                             | Result                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Dependency install                      | `npm install`                                                       | ✅ succeeded                                                                                         |
| TypeScript                              | `npm run typecheck`                                                 | ✅ 0 errors                                                                                          |
| ESLint                                  | `npm run lint`                                                      | ✅ 0 errors, 0 warnings                                                                              |
| Prettier                                | `npm run format:check`                                              | ✅ all files formatted                                                                               |
| Unit tests                              | `npm run test:unit`                                                 | ✅ 7 / 7 passed                                                                                      |
| Production build                        | `npm run build`                                                     | ✅ succeeded (9 routes static)                                                                       |
| Fixture build                           | `node scripts/build-fixtures.mjs`                                   | ✅ succeeded                                                                                         |
| Playwright E2E (desktop 1440 + Pixel 7) | `npm run test:e2e`                                                  | ✅ 67 passed, 0 failed, 15 skipped (device-specific tests intentionally skipped on the other device) |
| Dependency audit                        | `npm audit`                                                         | ✅ 0 vulnerabilities                                                                                 |
| SEO with domain set                     | throw-away build with `NEXT_PUBLIC_SITE_URL=https://www.example.lk` | ✅ sitemap, robots `Sitemap:`, canonical, og:url, og:image, JSON-LD url correct                      |
| Visual review                           | `tests/tools/screenshots.mjs` at 320/390/1440                       | ✅ reviewed manually                                                                                 |

The E2E suite covers: all pages load (HTTP 200, single h1, title, description, `lang`), unique titles, 404
status/page, no console errors / CSP violations / page errors, no broken images, header logo loads, desktop nav

- `aria-current`, footer links, skip link, mobile menu (open, focus, Escape, focus return, navigation), tel/mailto/
  Facebook/maps hrefs, `rel="noopener noreferrer"` on every external link, no WhatsApp/TikTok links, no placeholder
  numbers / ratings / invented hours, axe-core WCAG 2.0/2.1/2.2 A+AA + best-practice on all pages (desktop + mobile),
  no horizontal scroll at 320/360/390/768/1024/1366/1440/1920 px, header touch targets ≥ 44 px, content visible with
  reduced motion, gallery empty state, lightbox keyboard behaviour, robots/sitemap, structured data fields, OG tags,
  security headers.

## 3. Lighthouse 13.5 (local static server with Brotli, final build)

| Page     | Mobile – applied “Slow 4G” throttling | Mobile – simulated (default)     | Desktop              |
| -------- | ------------------------------------- | -------------------------------- | -------------------- |
| Home     | 85 / 100 / 100 / 100 · LCP 1.7 s      | 62 / 100 / 100 / 100 · LCP 6.4 s | 96 / 100 / 100 / 100 |
| About    | 85 / 100 / 100 / 100 · LCP 1.9 s      | 67 / 100 / 100 / 100             | 97 / 100 / 100 / 100 |
| Services | 84 / 100 / 100 / 100 · LCP 1.8 s      | 65 / 100 / 100 / 100             | 97 / 100 / 100 / 100 |
| Gallery  | 90 / 100 / 100 / 100 · LCP 1.8 s      | 70 / 100 / 100 / 100             | 97 / 100 / 100 / 100 |
| Contact  | 84 / 100 / 100 / 100 · LCP 2.0 s      | 67 / 100 / 100 / 100             | 97 / 100 / 100 / 100 |

(Performance / Accessibility / Best Practices / SEO.) CLS ≤ 0.009 everywhere.

**Target status:** Accessibility, Best Practices and SEO targets (≥ 95) are met on every page. Performance ≥ 90 is
met on desktop, **not met on mobile** (84–90 applied, 62–70 simulated). The remaining cost is Total Blocking Time
from Next.js/React hydration (~150 KB compressed framework JS) on a 4× throttled CPU, which Lighthouse’s simulated
model also attributes to LCP. Improvements already applied: compressed transfer, inlined CSS, a single preloaded
font family, transform-only animation on large hero text, compressed icons. Further gains would require removing
the React runtime (e.g. a non-React static generator), which conflicts with the required stack. Scores on a real
host/CDN will differ from this local measurement.

## 4. Known issues and limitations

- Mobile Lighthouse performance below the 90 target (see above).
- `experimental.inlineCss` is an experimental Next.js flag (kept for a measured ~1 s mobile FCP gain; easy to remove).
- Windows-only Next.js 16.4 export bug (segment prefetch filenames) is corrected by `scripts/postbuild.mjs`.
- The lightbox is verified only with synthetic test patterns because no approved photos exist yet.
- The Google Maps link is an address **search**, not a verified pin.
- Copyright year is fixed at build time.
- Lighthouse and E2E tests were run in Chromium only (Firefox/WebKit not installed in this environment; low disk
  space on drive C: — caches were redirected to D:).
- The Sinhala slogan appears only inside the logo image; it is not transcribed as text (wording not verified).

## 5. Outstanding business information

Domain · opening hours · exact map pin / coordinates · WhatsApp number (if any) · delivery areas/charges/timing ·
reservation process · TikTok URL · approved product categories/brands · establishment year · genuine store
photographs. See `docs/OWNER-CHECKLIST.md`.

## 6. Security checks performed

- `npm audit` → 0 vulnerabilities (after a scoped `minimatch@11.0.3` override for a moderate dev-only advisory,
  GHSA-g3hv-75wg-m249; ESLint re-verified working).
- Packages pinned to exact versions; avoided releases < 2 weeks old where possible (Next 16.4.6 kept as the official
  scaffold’s current security-patched release).
- No secrets, API keys, backend endpoints, cookies, forms or third-party scripts; verified by review and tests.
- CSP without `unsafe-inline`/`unsafe-eval` for scripts, verified in the browser by the E2E suite (no CSP
  violations on any tested flow, including client navigation and the lightbox).
- JSON-LD injection safety unit-tested; all external links verified for `noopener noreferrer`.
- Not performed: external penetration test, header verification on the real production host (domain not yet chosen).

## 7. Deployment readiness

**Technically ready for deployment** to an HTTPS static host (`npm run build` → upload `out/`).
**Before public launch**, the owner should: confirm the domain (and rebuild with `NEXT_PUBLIC_SITE_URL`), approve
page wording, and check the Google Maps search result. Other outstanding details can be added later without code
changes.
