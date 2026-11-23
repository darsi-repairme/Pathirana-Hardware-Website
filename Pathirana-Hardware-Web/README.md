# Pathirana Hardware (Pvt) Ltd. — Business Website

The public information website for **Pathirana Hardware (Pvt) Ltd.**, Pallama Road, Bangadeniya, Sri Lanka.
Tagline: _“Shop smarter, save bigger!”_

This is a **static, information-only website**. It is _not_ the POS system (developed separately) and has no
logins, cart, checkout, payments, ordering, database or backend API.

---

## Contents

1. [Technology stack](#technology-stack)
2. [Folder structure](#folder-structure)
3. [Setup](#setup)
4. [Commands](#commands)
5. [Updating business details](#updating-business-details)
6. [Replacing / adding gallery images](#replacing--adding-gallery-images)
7. [Updating the logo](#updating-the-logo)
8. [Deployment](#deployment)
9. [Security](#security)
10. [Performance notes](#performance-notes)
11. [Known issues](#known-issues)

---

## Technology stack

| Area      | Choice                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16.4 (App Router, `output: "export"` static export, Turbopack)                                                                                                                                                     |
| UI        | React 19.3 Server Components; client components only for the mobile menu, nav and lightbox                                                                                                                                 |
| Language  | TypeScript (strict, `noUncheckedIndexedAccess`)                                                                                                                                                                            |
| Styling   | Tailwind CSS 4 with design tokens in `src/app/globals.css` (`@theme`)                                                                                                                                                      |
| Fonts     | Playfair Display (headings) + Inter (body), self-hosted via `next/font` (no Google requests at runtime)                                                                                                                    |
| Icons     | Lucide React                                                                                                                                                                                                               |
| Animation | CSS only (keyframes + scroll-driven animations as progressive enhancement). Motion for React was deliberately **not** added: every effect is achievable in CSS with zero JavaScript, and content stays visible without JS. |
| Quality   | ESLint (Next core-web-vitals + TypeScript), Prettier (+ Tailwind class sorting)                                                                                                                                            |
| Tests     | Node test runner (unit), Playwright + axe-core (end-to-end, accessibility, responsive)                                                                                                                                     |

**Design system:** Forest Green `#0F5D3A` (primary), Brass Gold `#B8860B` (accent), Warm Cream `#F8F6ED`
(background), Dark Charcoal `#1F1F1F` (text). Gold is never used for small text on light backgrounds — a darker
`brass-ink #7A5A0A` (5.9:1) is used instead. Contrast notes are at the top of `globals.css`.

## Folder structure

```
src/
  app/                    Routes (one folder per page) + metadata files
    page.tsx              Home  /
    about/page.tsx        /about/
    services/page.tsx     /services/
    gallery/page.tsx      /gallery/
    contact/page.tsx      /contact/
    not-found.tsx         404 page
    layout.tsx            Root layout: fonts, header, footer, JSON-LD
    globals.css           Design tokens, textures, motion
    sitemap.ts robots.ts  SEO files (static)
    icon.png apple-icon.png
  components/
    layout/               SiteHeader, NavLinks, MobileMenu, SiteFooter
    home/                 Hero, HeroVisual, Highlights, AboutPreview, ServicesPreview, GalleryPreview
    about/ services/ gallery/ contact/
    ui/                   Button, Container, SectionHeading, PageHero, Logo, FacebookIcon
  content/                ★ All editable content lives here
    business.ts           Business facts (single source of truth)
    navigation.ts         Menu items
    services.ts           Services list
    gallery.ts            Gallery entries (+ gallery-manifest.json, generated)
  lib/                    metadata, structured data, site URL helpers
public/images/
  pathirana-logo.png      ORIGINAL logo (source of truth)
  brand/                  Generated logo sizes + social image
  gallery/                Generated gallery images
assets/gallery/           Owner-approved original photos (not published)
scripts/                  Asset preparation, post-build security headers, static preview server
tests/unit/               Node unit tests
tests/e2e/                Playwright tests
docs/                     Owner checklist and implementation report
```

## Setup

Requirements: **Node.js 20.9+** (developed on Node 24) and npm.

```bash
npm install
npx playwright install chromium   # only needed to run browser tests
```

## Commands

| Command                            | What it does                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                      | Development server at http://localhost:3000                                                                                        |
| `npm run build`                    | Production static export to `out/` + generates security header files                                                               |
| `npm start`                        | Serves `out/` locally at http://127.0.0.1:4173 (behaves like a static host)                                                        |
| `npm run typecheck`                | TypeScript validation                                                                                                              |
| `npm run lint`                     | ESLint                                                                                                                             |
| `npm run format` / `format:check`  | Prettier                                                                                                                           |
| `npm run test:unit`                | Unit tests (business data, URLs, structured data, JSON-LD escaping)                                                                |
| `npm run test:e2e:build`           | Builds `out/` and the test-only `out-fixtures/` (gallery test patterns)                                                            |
| `npm run test:e2e`                 | Playwright: pages, navigation, mobile menu, contact links, a11y (axe), responsive widths 320–1920, lightbox, SEO, security headers |
| `npm audit`                        | Dependency vulnerability audit                                                                                                     |
| `npm run check`                    | Everything above, in order                                                                                                         |
| `npm run assets`                   | Regenerates logo sizes, icons and social image from the original logo                                                              |
| `npm run gallery`                  | Processes photos in `assets/gallery/` into responsive WebP files                                                                   |
| `node tests/tools/screenshots.mjs` | Full-page screenshots of every page at several widths (server must be running)                                                     |

## Updating business details

**Edit only `src/content/business.ts`.** Every page, the footer, contact links and search-engine structured data
read from it.

- Fields currently `null` are **hidden** on the website until confirmed:
  - `openingHours` — e.g. `[{ days: "Monday – Saturday", hours: "8.00 am – 6.00 pm" }]` → appears on the Contact page.
  - `whatsappE164` — e.g. `"+9471…"` → adds a WhatsApp option on the Contact page. **Only if WhatsApp is confirmed.**
  - `verifiedMapUrl` — the owner’s exact Google Maps place link → replaces the address _search_ link everywhere.
  - `geo` — verified coordinates → added to structured data.
  - `foundedYear` — added to structured data.
  - `social.tiktok.url` — only once the profile URL is verified.
- Services: edit `src/content/services.ts`. When delivery or reservation details are confirmed, change `status` to
  `"confirmed"` and list the confirmed facts in `details`.
- Never add placeholder numbers, invented hours, sample reviews or ratings. The test suite checks for these.

After editing, run `npm run check` (or at least `npm run build`) before deploying.

## Replacing / adding gallery images

Only genuine, owner-approved photographs of the business may be used — no stock or AI images.

1. Copy the original photos into `assets/gallery/` (e.g. `storefront.jpg`). These originals are not published.
2. Run `npm run gallery`. This creates 640/1280/1920px WebP files in `public/images/gallery/`, strips EXIF/GPS
   metadata, and writes `src/content/gallery-manifest.json`.
3. In `src/content/gallery.ts`, add one entry per photo:
   ```ts
   { slug: "storefront", alt: "Front of the Pathirana Hardware store on Pallama Road", caption: "Our store" },
   ```
   `slug` = file name without extension (lower-case, spaces → hyphens). Write alt text describing what is visible.
4. Rebuild. The gallery page and home-page preview switch from the “coming soon” state to the photo grid with a
   keyboard-accessible lightbox automatically.

See `docs/OWNER-CHECKLIST.md` for the list of requested photos.

## Updating the logo and main images

Main images live in `public/images/`:

| File                                   | Used for                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pathirana-logo.png`                   | ORIGINAL logo (source of truth; icons and social image)                                                                   |
| `pathirana-logo-transparent.png`       | Generated: logo without its white background — header                                                                     |
| `pathirana-logo-transparent-light.png` | Generated: same, with cream lettering for dark green — footer. The red/green mark is unchanged                            |
| `pathirana-hero-helmet-banner.png`     | Homepage hero banner                                                                                                      |
| `pathirana-shop-about.png`             | Storefront photo — homepage About section and About page (also copied to `assets/gallery/storefront.png` for the Gallery) |

These are shown with `next/image`. Because the site is a static export, `npm run assets` pre-renders each one as
high-quality WebP (quality 90) at every width the site requests, up to the original resolution (never upscaled), into
`public/images/opt/`; `src/lib/image-loader.ts` maps requests to those files.

To replace one: overwrite the file with the same name, run `npm run assets` (and `npm run gallery` for gallery
photos), then rebuild. For the sharpest results on large/high-density screens, supply images at least 1920 px wide.

## Deployment

The site is a folder of static files. Any HTTPS static host works.

### 1. Build with the confirmed domain

The production domain is **not yet confirmed**. Until `NEXT_PUBLIC_SITE_URL` is set, canonical URLs, sitemap
entries and social-share image URLs are deliberately omitted (the build prints a warning).

```bash
# macOS/Linux
NEXT_PUBLIC_SITE_URL=https://www.your-domain.lk npm run build
# Windows PowerShell
$env:NEXT_PUBLIC_SITE_URL="https://www.your-domain.lk"; npm run build
```

Upload the **contents of `out/`**.

### 2. Host-specific notes

`npm run build` generates the security headers for you:

| Host                               | What to do                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Netlify** / **Cloudflare Pages** | Publish directory `out`, build command `npm run build`, set `NEXT_PUBLIC_SITE_URL`. `out/_headers` is applied automatically.                                                                    |
| **cPanel / Apache shared hosting** | Upload `out/` contents (including the hidden `.htaccess`) to `public_html`. Install an SSL certificate (e.g. AutoSSL / Let’s Encrypt), then un-comment the HTTPS redirect lines in `.htaccess`. |
| **nginx**                          | Use `try_files $uri $uri/index.html =404; error_page 404 /404.html;` and copy the headers from `build-reports/security-headers.json` into `add_header … always;` lines.                         |
| **Vercel**                         | Works as a static export; add the headers from `build-reports/security-headers.json` to `vercel.json`.                                                                                          |

> **Important:** the Content-Security-Policy contains hashes of the exact inline scripts in _this_ build. Always
> deploy `_headers` / `.htaccess` together with the HTML from the **same** build. Do not hand-copy an old CSP.

### 3. After going live

- Confirm HTTPS works and `http://` redirects to `https://`.
- Check `https://your-domain/robots.txt` and `/sitemap.xml`.
- Submit the sitemap in Google Search Console; create/claim the Google Business Profile with the same name,
  address and phone number.
- Optionally verify headers at <https://securityheaders.com>.

## Security

- No backend, database, forms, cookies, analytics, trackers or third-party scripts.
- No secrets or API keys in the code. Build-time variables: `NEXT_PUBLIC_SITE_URL` (public site URL) and, optionally,
  `NEXT_PUBLIC_API_URL` — the separate website API (`D:\Pathirana-Hardware-Backend`) used only by the Home page
  delivery-area checker. When it is unset, that section asks customers to confirm coverage on WhatsApp. Setting it
  adds the API origin to the CSP `connect-src`.
- Strict CSP: `script-src 'self'` + SHA-256 hashes (no `unsafe-inline`, no `unsafe-eval`), `frame-ancestors 'none'`,
  `object-src 'none'`. Also `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`,
  COOP/CORP and HSTS (HTTPS only).
- External links use `target="_blank" rel="noopener noreferrer"` (enforced by tests).
- The single `dangerouslySetInnerHTML` is the JSON-LD block built from our own config, with `<` escaped
  (unit-tested against `</script>` injection).
- Gallery processing strips photo EXIF/GPS metadata.
- Dependencies are pinned to exact versions; `npm audit` reports 0 vulnerabilities at the time of writing. One
  scoped override (`minimatch@11.0.3` for `@typescript-eslint/typescript-estree`) fixes a moderate DoS advisory in
  the **dev-only** lint toolchain.
- Run `npm audit` regularly and update Next.js/React patch versions promptly.

## Performance notes

- CSS is inlined into each page (`experimental.inlineCss`) — measured to cut mobile first paint from ~2.9 s to
  ~1.8 s under Lighthouse applied “Slow 4G” throttling. It is an experimental Next.js flag; remove it from
  `next.config.ts` if it ever causes problems (the CSP generator handles either mode).
- Only the display font is preloaded; Inter loads with `font-display: swap` and a size-matched fallback (no CLS).
- Logo and gallery images are pre-sized responsive WebP with explicit dimensions; below-the-fold images lazy-load.
- Lighthouse results are in `docs/IMPLEMENTATION-REPORT.md`.

## Known issues

- **Windows build workaround:** Next.js 16.4 static export on Windows writes prefetch files into nested folders
  (`about/__next.about/__PAGE__.txt`) while the browser requests `about/__next.about.__PAGE__.txt`.
  `scripts/postbuild.mjs` flattens these automatically (no-op on Linux/macOS).
- The footer copyright year is set at build time; rebuild once a year (or on any content update).
- See `docs/IMPLEMENTATION-REPORT.md` for the full list of limitations and outstanding owner information.

## Homepage images and 3D scenes

- Homepage photographs and the stand-alone logo mark live in `assets/images/` (originals are not published). Replace a file there with the same name, then run `npm run assets` to regenerate the WebP files in `public/images/opt/`.
- `assets/approved-homepage-reference.png` is the approved homepage design.
- The Services and Find Our Store sections use small Three.js scenes (`src/components/three/`). three.js loads only when those sections near the screen, pauses off-screen, shows a single still frame when the visitor prefers reduced motion, and falls back to a static drawing when WebGL is unavailable.
- After every `npm run build`, restart the preview server (`npm start`): it reads the generated security headers once at start-up, so an old server blocks the new build's scripts.

## Products, search, enquiry list, testimonials and WhatsApp

- **Products** (`/products/`) lists four broad categories from `src/content/products.ts`. ⚠ The business must confirm these categories. Add a verified catalogue to `catalogue` in the same file when one is supplied; search (`src/lib/product-search.ts`) already includes it.
- **Search** (header and Products page) only matches those categories, and their everyday search terms. A search with no match tells visitors to call or email; it never shows invented results.
- **Cart icon** opens a product _enquiry_ list (`src/lib/enquiry-basket.ts`). There is no checkout, payment or ordering. Only verified catalogue items can be added, so it currently always shows its empty state and no count.
- **Customer feedback** ("What Our Customers Say") only appears once real, approved testimonials are added to `src/content/testimonials.ts`.
- **WhatsApp**: set `whatsappE164` in `src/content/business.ts` only after the owner confirms the WhatsApp number. Until then no WhatsApp link is published, and the contact band offers Email instead.
