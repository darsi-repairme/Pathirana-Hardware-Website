# Pathirana Hardware — Project Progress

Last updated: 2026-11-18 (Batch 5B + 5C ACTIVE locally — migration 0004 applied (owner-approved),
API and Admin restarted on the current code). Next: owner manual check, then Batch 6 / cloud
migration (each needs separate approval). Read this first in a new session.

## Stage 1 activation — Batch 5B + 5C live locally (2026-11-18, owner-approved)

- **Pre-check:** state identical to the preflight (0001–0003 applied, 0004 pending; 1 active admin;
  UltraTech active + logo; 8 areas; 15 audit rows; 0 categories/products). Media backup
  `D:\Pathirana-Hardware-Backups\20261118-171536\media-uploads-20261118-171536.tar.gz` re-verified
  against the current upload folder (1/1 file, SHA-256 OK).
- **Fresh backup immediately before 0004:**
  `D:\Pathirana-Hardware-Backups\20261118-175332-pre-0004\pathirana_website-20261118-175332-pre-0004.dump`
  (custom format, 9 tables + data, `pg_restore --list` OK; SHA-256 in the `.sha256` file next to it).
- **Migration:** `npm run db:migrate -- --apply --confirm-database=pathirana_website` applied only
  `0004_quotation_requests.sql`; history 0001–0004, "No pending migrations"; 3 new tables with all
  CHECK / FK / unique constraints, 12 indexes and the `updated_at` trigger; all existing rows unchanged;
  the 3 quotation tables are empty (no test data in the permanent database).
- **Services (current code):** API `http://127.0.0.1:4000` (`node dist/main.js`, rebuilt 17:53; health
  `database: up`; `POST /api/v1/quotations` validates; staff routes 401 without a session); Admin
  `http://127.0.0.1:4400` (rebuilt, includes Quotation Requests + product deletion); website preview
  `http://127.0.0.1:4173` (rebuilt; CSP `connect-src`/`img-src` allow the API; CORS OK).
- **Fix found by the real end-to-end test:** the website CSP blocked `blob:` images, so photo previews
  in the quotation form did not render (upload itself worked). `scripts/postbuild.mjs` now allows
  `img-src … blob:` (browser-local previews only); `quotation.spec.ts` now checks the preview renders.
- **Floating WhatsApp button:** probed every PAGES page at 320 and 390 px at every scroll position —
  it never hides a control at the page bottom/footer; only an inline phone link in the About story
  passes under it at one mid-page scroll position (tappable after a small scroll). No change. Contact
  "View all FAQs" works on mobile and desktop (the earlier failure was a load time-out).
- **Test-selector fix:** `detail-pages.spec.ts` scopes "Request a Quotation" to `main` (the footer has a
  link with the same name).
- **Tests (isolated data only):** Backend 56/56; Admin 24 passed / 4 skipped by design; website
  `detail-pages` + `quotation` + `navigation` 56 passed / 6 skipped; `quotation.spec.ts` 14/14; REAL
  end-to-end `npm run test:live-stack` 2/2 (desktop + Pixel 7) incl. the quotation form with a photo,
  staff-only photo access (401 without a token), and permanent deletion.
- **Final website regression (full Playwright run, once):** 234 passed / 7 failed / 43 skipped. 2 were a
  genuine rule violation — the quotation form showed an example phone number, which the "no placeholder
  phone numbers" check rejects; the hint and the validation message now contain no number. The other 5
  were load time-outs (3D services ring, hero carousel timing, two ten-page loops). All 7 re-run one at
  a time: 7/7 passed; `quotation.spec.ts` 14/14 after the wording change.
- **Still open:** the owner's manual check with real data (the Batch 5A checklist, plus: submit a real
  quotation request from a phone, open it in Admin → Quotation Requests, view the photo, change the
  status and use "WhatsApp customer"); no physical iPhone/Safari test yet; GitHub, Supabase and
  deployment not started (each needs approval).

## Recovery audit — verified state (2026-11-18, read-only)

Verified from the code, the running services and the database (not from earlier notes):

- **No Git repository** in `D:\Pathirana Hardware` or any of the three projects; no remotes, no GitHub.
  Source backups exist only as `.tgz` files in `D:\.tmp` (Batch 5A). No cloud deployment: no
  `vercel.json` / `.vercel` / `render.yaml` / `supabase` config; the connected Vercel account has no
  Pathirana project; the only Supabase project is an unrelated, inactive one.
- **Database:** local PostgreSQL 18 `127.0.0.1:5432/pathirana_website`; migrations 0001–0003 applied,
  **0004 pending**; 1 active admin; 0 categories, 0 products; 1 brand (UltraTech — now active, with an
  uploaded logo); 8 active delivery areas (Anamaduwa, Arachikattuwa, Bangadeniya, Chilaw, Marawila,
  Pallama, Puttalam, Wennappuwa). Media: local disk (`Backend/storage/uploads`), not in the DB dumps.
  DB backups: `D:\.tmp\pathirana-db-backup-before-0002.dump`, `…-before-0003.dump` (no media backup).
- **Running services do NOT match the latest code:**
  - API (4000) process started 10:26 — serves the Batch 5A code: `POST /api/v1/quotations`,
    `/admin/quotations` and `DELETE /admin/products/:id` → 404. Its `dist/` was rebuilt at 12:10 with
    5B/5C and `migrations/0004` exists, so **a restart now would fail** (pending-migration check) until
    0004 is applied.
  - Admin (4400) serves the 10:29 build (no Quotation Requests / delete). The 5B/5C Admin exists only
    in the test build `.next-e2e`.
  - Website preview (4173) serves the 16:32 build WITH the quotation form, floating WhatsApp button and
    product actions — so today the form cannot save (the API answers 404; the form shows an honest error).
- **Tests at the end of the 5B/5C session:** Backend 56/56; Admin 24 passed / 4 skipped; website unit
  24/24; new `quotation.spec.ts` 14/14. A targeted re-run of existing website specs still had 5
  failures: 2 time-outs (responsive loop at 1024/1366 px), 2 test-selector clashes (product-type pages:
  "Request a Quotation" now also matches the new footer link), 1 mobile "View all FAQs" click on
  /contact/ that did not navigate (possibly the new floating WhatsApp button overlapping — to verify).
  The real end-to-end `test:live-stack` with the new quotation step was written but **not yet run**.
- **Not implemented:** Tamil / Sinhala (no i18n anywhere); opening hours are hidden
  (`openingHours: null` — no verified hours supplied); product-detail and live-category pages are
  `noindex` `?slug=` shells (no indexable product URLs); no Admin audit-log screen (the dashboard shows
  the 8 latest entries only).

### Migration 0004 preflight and backups (2026-11-18 17:15)

- Backups (outside all projects, new folder, nothing overwritten):
  `D:\Pathirana-Hardware-Backups\20261118-171536\` — `pathirana_website-20261118-171536.dump` (custom
  format, 9 tables + data, `pg_restore --list` OK), `media-uploads-20261118-171536.tar.gz` (the whole
  `storage/uploads` tree: 1 file, the UltraTech logo; `gzip -t` OK; SHA-256 manifest
  `media-uploads-20261118-171536.sha256` re-verified after extraction).
- Preflight: that dump restored into a throwaway embedded PostgreSQL; `applyMigrations` applied only 0004;
  every existing row (admin incl. password hash, UltraTech + logo key, 8 areas, counts) identical before
  and after; quotation tables created; address-for-delivery CHECK enforced; throwaway DB deleted. The
  permanent database was not touched. 0004 is still pending there (awaiting approval).

## Batch 5B + 5C — quotation requests and product contact actions (2026-11-18)

**State: ACTIVE locally since 2026-11-18 (see "Stage 1 activation" above). Original note: code complete; tested on isolated databases (see the recovery audit above for the open test
items). Migration `0004_quotation_requests.sql` is
prepared and NOT applied to `pathirana_website`.** Until it is applied, the quotation form cannot save
requests on the live site, and the API must not be restarted (it refuses to start while a migration is
pending — the running process keeps serving the previous code).

- **Service areas — done on the live database (owner-confirmed data, no migration needed):** added
  Bangadeniya, Chilaw, Pallama, Anamaduwa, Arachikattuwa, Wennappuwa and Marawila with
  `npm run areas:add -- --apply --confirm-database=pathirana_website` (Backend; adds only missing names,
  audit-logged; no district/postal code/fee invented). The existing Puttalam record is unchanged. The
  public API lists all 8 (no fee field). Home "Do We Deliver to Your Area?" now also shows "We deliver
  to" with every active area; the quotation form's Location lists them plus "Other".
- **Migration 0004 (additive, awaiting approval):** tables `quotation_requests` (reference
  `PHQ-YYMMDD-XXXXX`, unique idempotency key, content hash, customer name, normalised phone, optional
  email, location + "listed" flag, delivery/collection, address required for delivery (CHECK), notes,
  consent (must be true), status new/in_review/quoted/closed/cancelled, who/when changed),
  `quotation_items` (position, product name as submitted, quantity NUMERIC(12,3), unit, optional link to
  a product `ON DELETE SET NULL`) and `quotation_photos` (private storage key, size). No existing data
  changes. Owner steps: back up (as for 0003), `npm run db:migrate`, then
  `npm run db:migrate -- --apply --confirm-database=pathirana_website`, restart the API
  (`node dist/main.js` or `npm start`), rebuild + restart the Admin (`npm run build`, `npm start`).
  The website is already rebuilt.
- **API:** `POST /api/v1/quotations` (public, no login; multipart `data` JSON + up to 5 `photos`):
  server-side validation of every field, phone normalised (+94…), location must be an active service
  area or "Other" + text, address only for delivery, quantity > 0 (≤ 3 decimals), consent required,
  photos decoded (JPEG/PNG/WebP only), ≤ 5 MB each, ≤ 5, rotated, metadata stripped, re-encoded to
  WebP (1600 px + 400 px thumb) under `UPLOAD_DIR/quotations` (no public route). Duplicate protection:
  the same form submission (idempotency key) or identical content from the same number within 10 min
  returns the existing reference. Rate limit: 6 submissions / 10 min per client. Response: reference,
  photo count, duplicate flag only. Staff (`quotations:manage` = admin + editor):
  `GET /admin/quotations?q=&status=&page=`, `GET /admin/quotations/:id`,
  `PATCH /admin/quotations/:id/status`, `GET /admin/quotations/:id/photos/:photoId?size=thumb`
  (private, no-store). Dashboard count `newQuotations`. No emails are sent.
- **Permanent product deletion (client requirement):** `DELETE /admin/products/:id` with
  `{ confirmSlug }` — admins only (`products:delete`), audit-logged; removes the product, its image
  rows and files and brand links; quotation items keep the product name (link set to NULL) and the
  response reports how many. Admin: "Delete permanently" card on Edit Product (admins only) that
  recommends unpublishing and requires typing the slug.
- **Website:**
  - `/quotation/` — Request a Quotation form (no login): name, phone/WhatsApp, location (8 areas +
    Other), several product rows (add/remove; quantity + unit with suggestions), delivery or collection
    (address only for delivery), optional email, notes and up to 5 reference photos (camera or gallery,
    previews, remove, type/size/count checks; large photos are shrunk in the browser), required consent.
    Prefilled from a product page (`?product=&slug=`). After the request is SAVED: reference number,
    honest message, WhatsApp opened if the browser allows, and an "Open WhatsApp" button with an
    editable message (reference, customer details, location, delivery/collection, items, notes, photo
    count referring to the reference). The customer taps Send; nothing claims it was sent.
  - Product pages (live `/products/item/` and the product-type pages): "Enquire on WhatsApp" (product
    name, reference, displayed price, page link, Quantity / Location placeholders), "Call Us"
    (`tel:+94712259699`) and "Request a Quotation".
  - Floating WhatsApp button on every public page (`https://wa.me/94712259699`, new tab).
  - Footer quick link and a Products-page link to the quotation form.
- **Admin:** "Quotation Requests" (nav + dashboard card): search (reference, name, phone, location,
  product), status filter with counts, pagination; detail with customer contact, consent, items,
  delivery/collection + address, notes, private photos (open full size), status change (who/when), and
  WhatsApp-customer / Call / Email actions. Editors can use it; Staff stays admin-only.

- **Migration 0003 — applied 2026-11-18 (owner-approved):**
  - new backup first: `D:\.tmp\pathirana-db-backup-before-0003.dump` (27,237 bytes, custom format,
    `pg_restore --list` OK, all 9 tables with data);
  - state before: 0001 + 0002 applied; 1 admin (active); 0 categories, 1 brand (UltraTech, inactive),
    0 products, 1 delivery area (Puttalam);
  - applied with `npm run db:migrate -- --apply --confirm-database=pathirana_website`; verified the
    7 new nullable columns, `brands_logo_complete` / `categories_image_complete` and the
    `brands_logo_key` / `categories_image_key` indexes; history = 0001, 0002, 0003; "No pending
    migrations"; all records and the administrator unchanged. No restore needed.
- **Services restarted with the new code:** API `http://127.0.0.1:4000` (`node dist/main.js`, health
  `database: up`), Admin `http://127.0.0.1:4400` (rebuilt), website preview `http://127.0.0.1:4173`
  (rebuilt with `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000`). All three verified connected.
- **Final rules (replacing the earlier "documented fallback"):**
  - With the API, categories and brands come ONLY from the API's active list. No documented data is
    ever substituted, so deactivated entries cannot reappear.
  - Loading → placeholders; no active entries → honest "Product categories / Brands are being added"
    (with Call / WhatsApp); API failure → honest "temporarily unavailable" with "Try again".
  - The static category pages (`/products/categories/<slug>/`) and product-type pages
    (`/products/<type>/`) show their content only while that category is ACTIVE; otherwise "Category /
    Product not available" (or "Temporarily unavailable" if the API fails).
  - Original logos / category artwork are used only for ACTIVE records with the matching slug
    (`pe-plus`, `swisstek`, `el-toro`, `wurth`; the 7 category slugs) until staff upload their own.
  - Header search suggestions: only active live names (documented terms only in non-API builds).
  - Delivery fees are removed from the PUBLIC API (`/delivery-areas`, `/delivery-areas/check`) as well as
    the website; the `fee_lkr` column and the staff (admin) endpoints are unchanged.
  - Permanent product deletion is not supported (products are unpublished instead), so there is no
    deletion confirmation to verify.
- **Additional files changed in this step:** Backend `src/delivery-areas/delivery-areas.ts`,
  `test/delivery-areas.e2e-spec.ts`. Website `src/lib/live-taxonomy.ts`, `src/lib/taxonomy.ts`,
  `src/lib/api.ts`, `src/components/products/TaxonomyStates.tsx` (new: notices + `ActiveCategoryGate`),
  `BrandLogos.tsx`, `CategoryShowcase.tsx`, `CategoryLinks.tsx`, `src/components/home/HomeCategoryCards.tsx`,
  `src/components/layout/HeaderSearch.tsx`, `src/app/products/categories/[slug]/page.tsx`,
  `src/app/products/[slug]/page.tsx`; tests `tests/e2e/fixtures.ts`, `live-taxonomy.spec.ts`,
  `tests/live-stack/live-stack.spec.ts`.
- **Owner's manual verification (real business data, permanent database) — please do in order:**
  1. If the computer was restarted: run `D:\PostgreSQL\start-postgres.cmd`, then start the API
     (Backend: `npm start`), the Admin (Admin: `npm start`) and the website preview (Web:
     `node scripts/serve-static.mjs out 4173`).
  2. Sign in at `http://127.0.0.1:4400` with your administrator account.
  3. Open `http://127.0.0.1:4173/` and `/products/`: with nothing active you should see "Product
     categories are being added" and "Brands are being added" (no old lists).
  4. Categories: add your first real category (e.g. one of Building Materials, Steel Products, Plywood,
     Doors & Windows, Bathroom & Sanitary, Gas Cylinders, Branded Hardware — keep the suggested slug so
     the existing page and artwork are used). Reload Home, `/products/` and `/about/`: it appears. Edit
     its description → reload → updated. Upload a real photo (Image) → it replaces the artwork; Remove →
     the artwork returns.
  5. Brands: UltraTech is currently inactive. Activate it (or add another real brand) → reload
     `/products/`: its NAME appears. Upload its original logo (Logo) → the logo appears; Replace / Remove
     work. Add PE+ / Swisstek / El Toro / Würth only if you sell them: their original logo files appear
     automatically.
  6. Products: add a real product with its real unit, price and (if any) real discount in an ACTIVE
     category; check the Price preview; add its photo; Publish → it appears on `/products/`, in search
     (by name, category or brand), in the category filter and on its category page; open its detail
     page. Change price / Contact for Price / availability → reload → updated. Unpublish → gone, and its
     detail link shows "Product not found".
  7. Temporarily deactivate one of your real brands → it disappears everywhere (and if it was the only
     active one, "Brands are being added" shows); re-activate it. Deactivating a category also hides its
     page ("Category not available") and its products; re-activate it.
  8. Delivery: Puttalam is active. On Home, "Do We Deliver to Your Area?" → type Puttalam → "Yes — we
     deliver…" with no fee shown; an unlisted town → the WhatsApp enquiry. Add/edit an area → reload →
     the checker follows.
  9. Permissions: sign out → `/products`, `/brands` etc. redirect to sign-in. (An editor account cannot
     open Staff.)
     When all of this matches, Batch 5A can be signed off.
- **Tests after the final changes (2026-11-18, isolated data only):**
  - Backend: typecheck, lint, build OK; `npm test` 49/49 (incl. the public delivery API never returning
    `feeLkr` while the staff API still does).
  - Admin: typecheck, lint, build OK; Playwright 21 passed, 3 skipped by design.
  - Website: typecheck, lint, prettier, build OK; unit 24/24.
  - REAL end-to-end `npm run test:live-stack` (throwaway PostgreSQL → API → site), desktop + Pixel 7:
    2/2 — fresh database shows the honest empty states and gates the Plywood page; then add / edit /
    image / deactivate category, add / logo / deactivate brand (→ "being added", nothing documented
    reappears), product draft → publish → edit → unpublish, search and filters, delivery area with a fee
    (none shown).
  - Website full Playwright run: 191 passed / 32 failed / 43 skipped. The machine was heavily loaded
    (an old `next dev` server from earlier in the session and two orphaned test databases were still
    running — all stopped). Re-running the 32: 21 passed; the remaining 11 run one at a time: 10
    passed; the last (`contact.spec.ts`, ten page loads per test) passes alone and is now marked
    `test.slow()` together with its sibling loop. All failures were time-outs, none an assertion on
    wrong content. A single clean full run was not achieved in this session.
  - Not done: physical iPhone / Safari testing (Chromium desktop + Pixel 7 emulation only).
- **Remaining limitations:**
  - Static category / product-type pages now wait for the live category check before showing content
    (a short skeleton; ~1 s locally) — the cost of never showing an inactive category.
  - Product-detail and live-category pages use `?slug=` shells marked `noindex` (final SEO phase).
  - The sitemap still lists the 7 documented category and 8 product-type URLs (static export).
  - Permanent product deletion is not supported (unpublish instead).
  - The local preview server compresses every response on the fly (CPU-heavy under test load); a real
    static host does this once.

## Batch 5A — frontend integration correction (2026-11-18)

**Superseded in part by "final completion" above** (0003 is now applied; the documented-list fallback
was removed). Kept for the history of what changed.

- **Root cause of "a new brand does not appear":** only the product list/filters, product detail and the
  delivery checker read the API. The Products-page brand showcase, Browse by Category, the Home category
  cards, the About category list, the category pages' "Other categories" / brand names and the header
  search suggestions all read the static arrays in `src/content/products.ts`. There was also no way to
  store a brand logo or a category image (no columns, no endpoints, no Admin screen).
- **Rules now:**
  - API build: those sections show the ACTIVE categories / brands from the API (no rebuild). Pages are
    pre-rendered with the documented lists and switch once the live list loads. The documented lists
    stay only while the API is unreachable or has no active entries yet (nothing set up).
  - Brand display: staff-uploaded logo → the client's original logo file for the documented slugs
    (`pe-plus`, `swisstek`, `el-toro`, `wurth`) → the brand NAME (a logo is never generated).
  - Category display: uploaded image → the bundled artwork for the 7 documented slugs → an icon card.
  - The 7 documented categories keep their static URLs; staff-added categories use
    `/products/category/?slug=…` (one static shell, `noindex`). Documented slugs redirect to their page.
  - Live product search also matches category and brand names.
  - The Home delivery checker no longer shows a delivery fee (public site shows no charges).
  - Header search fetches live names only after the search box is focused (not on every page view).
- **Migration 0003 (additive, awaiting approval):** `brands.logo_key/logo_width/logo_height` and
  `categories.image_key/image_width/image_height/image_alt` (all nullable, "all or none" CHECKs, unique
  partial indexes on the keys). No rows change. Owner steps: back up the database (as for 0002), then
  `npm run db:migrate` (read-only), `npm run db:migrate -- --apply --confirm-database=pathirana_website`,
  restart the API (`npm start`), then Admin `npm run build` and restart `npm start` (4400). The website
  needs no rebuild.
- **API:** `GET /brands` → `logo: {url,width,height}|null`; `GET /categories` → `image: {url,thumbUrl,alt,
width,height}|null`; public files `GET /brand-logos/:key`, `GET /category-images/:key?size=thumb`
  (active brands/categories only, 404 otherwise); staff: `POST|DELETE|GET /admin/brands/:id/logo`,
  `POST|PATCH|DELETE|GET /admin/categories/:id/image` (audit-logged). Logos are stored as LOSSLESS WebP
  (exact pixels and transparency, ≤ 800 px); category images like product images (1600 + 480 px WebP,
  metadata stripped). Same upload checks as product images (decoded, JPEG/PNG/WebP, size limit).
- **Admin:** Brands — "Logo" (upload / replace / remove; shows uploaded logo, else the original file, else
  "No logo — name shown"). Categories — image thumbnail column and "Image" (upload with alt text, edit
  alt text, replace, remove). Shared `src/components/MediaUploadDialog.tsx`.
- **Files changed:**
  - Backend: `migrations/0003_brand_logos_category_images.sql` (new), `src/catalogue/media.service.ts`
    (new), `brands.ts`, `categories.ts`, `catalogue.module.ts`, `products.service.ts` (search);
    tests `test/media.e2e-spec.ts` (new), `catalogue.e2e-spec.ts` and `pricing.e2e-spec.ts` (contract
    updates + search by category/brand name).
  - Admin: `src/lib/api.ts`, `src/components/MediaUploadDialog.tsx` (new), `src/app/(admin)/brands/page.tsx`,
    `src/app/(admin)/categories/page.tsx`, `tests/admin.spec.ts`, `eslint.config.mjs` / `.prettierignore`
    (ignore `.next-*` test builds), `tsconfig.json` (formatting only).
  - Website: `src/lib/taxonomy.ts` + `src/lib/live-taxonomy.ts` (new), `src/lib/catalogue.ts`,
    `src/components/products/{CategoryVisual,CategoryLinks,LiveCategoryPage}.tsx` (new),
    `src/app/products/category/page.tsx` (new), `BrandLogos.tsx`, `CategoryShowcase.tsx`,
    `ProductDetail.tsx`, `src/components/home/{ProductsSection,HomeCategoryCards (new),DeliveryAreas}.tsx`,
    `src/components/layout/HeaderSearch.tsx`, `src/app/about/page.tsx`,
    `src/app/products/categories/[slug]/page.tsx`, `src/app/globals.css` (odd-last-tile rule);
    tests `tests/e2e/fixtures.ts` + `live-taxonomy.spec.ts` (new; all specs import `./fixtures`),
    `delivery-areas.spec.ts`; real end-to-end `tests/live-stack/*`, `playwright.live-stack.config.ts`,
    `scripts/build-live-stack.mjs`, `npm run test:live-stack` (builds `out-live`, ignored like
    `out-fixtures`).
- **Tests (2026-11-18, all on isolated data):**
  - Backend: typecheck, lint, build OK; `npm test` 49/49 (18 unit + 31 integration, incl. the new
    `media.e2e-spec.ts`: lossless logo pixels/transparency, replace → new URL + old file gone, inactive →
    404, alt text, audit log; search by category/brand name; 0001→0002→0003 on existing data).
  - Admin: typecheck, lint, build OK; Playwright 21 passed, 3 skipped by design (new: brand logo
    upload/replace/remove and category image upload/alt/remove through the UI, checked against the
    public API; 320–1440 px).
  - Website: typecheck, lint, prettier, build OK; unit 24/24; mocked e2e `live-taxonomy.spec.ts` (live
    lists, original-logo fallback, name-only brand, hidden inactive entries, empty/down API fallback, live
    category page, deferred header-search requests); full Playwright run 219 passed / 2 failed / 43
    skipped — the 2 were Services 3D teardown timeouts under load, both passed when re-run serially.
  - REAL end-to-end `npm run test:live-stack` (throwaway PostgreSQL → compiled API → site built against
    it), desktop + Pixel 7: 2/2 passed — add / edit / image / deactivate category; add / logo /
    deactivate brand; add draft → publish → edit (Contact for Price, Out of Stock) → unpublish product;
    search by brand name, category filter, category page, detail page; add delivery area (with a fee) →
    checker says yes and shows no charges; no horizontal overflow; no console/CSP/CORS errors.
- **Not present (not invented):** the Home page has no "Our Brands" and no "featured products" section
  (Home shows category cards; brands are on the Products page; there is no "featured" field).
- **Kept static on purpose:** the 7 documented category pages and 8 product-type pages (static export,
  existing URLs and content), the sitemap, and the documented product types shown on those pages; the
  static catalogue used only by builds without `NEXT_PUBLIC_API_URL`. A documented category deactivated
  by staff disappears from every listing, but its static page stays reachable by direct URL.

## Batch 5A — product prices, discounts, availability, live catalogue

**State: activated and verified on the live stack (2026-11-18).** One step remains before Batch 5A is
fully signed off: the owner's manual end-to-end check in the permanent database (see "Owner's manual
check" below). The permanent catalogue is still empty (0 categories, brands and products).

- **Migration 0002 — applied 2026-11-18 (owner-approved):**
  - backup re-checked first: `D:\.tmp\pathirana-db-backup-before-0002.dump` (24,585 bytes, custom
    format, `pg_restore --list` OK, all 9 tables);
  - pre-check matched the verified report (9 tables, only 0001 applied, one active admin);
  - applied with `npm run db:migrate -- --apply --confirm-database=pathirana_website`;
  - verified: the 9 new product columns, `product_images.is_main`, the 5 pricing CHECK constraints,
    the `product_images_one_main` unique partial index, `schema_migrations` = 0001 + 0002, "No pending
    migrations", the administrator account unchanged and active. No restore was needed.
- **Running services (local):**
  - PostgreSQL: `D:\PostgreSQL\start-postgres.cmd` (does not auto-start after a reboot);
  - API: `http://127.0.0.1:4000` (`npm start`; log `D:\.tmp\backend-5a.log`); `/api/health` →
    `{"status":"ok","database":"up"}`;
  - Admin: `http://127.0.0.1:4400` (`npm start`; log `D:\.tmp\admin-5a.log`);
  - Website preview: `http://127.0.0.1:4173` (`node scripts/serve-static.mjs out 4173`), built with
    `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000`. CSP `connect-src`/`img-src` allow exactly that origin;
    API CORS allows only `http://localhost:4173` and `http://127.0.0.1:4173`.
- **Stale-CSP preview — fixed.** The old preview process (started before the rebuild) kept serving the
  previous `_headers` and blocked the new inline scripts (React error #412 on every page). It was
  stopped and restarted, and `scripts/serve-static.mjs` now re-reads `_headers` on every request, so a
  rebuild can no longer leave a running preview with old script hashes. Verified: the served CSP allows
  every inline script on all 35 pages.
- **Live (real stack) checks, 2026-11-18:** public products/categories/brands return only published or
  active data (all empty today); unknown product slug and image → 404; admin and price-preview
  endpoints → 401 without a valid token; unknown origins get no CORS header; the website's
  `/products/` calls the real API (200) and shows the honest empty state; `/products/item/?slug=unknown`
  shows "not found"; no CSP or CORS errors; the Admin login page is served, protected pages redirect to
  sign-in, and a wrong sign-in is rejected by the real API.
- **Owner's manual check (permanent database) — pending.** No product, price or test record was created
  in `pathirana_website`. To finish:
  1. sign in at `http://127.0.0.1:4400` with the existing administrator account;
  2. add one REAL category (and optional brand), then one REAL product with its real unit, price,
     image and (if any) real discount; check the Price preview (Original / Discount / Final);
  3. Publish, then open `http://127.0.0.1:4173/products/`: the product, image, unit and final price
     appear without rebuilding the site; open its detail page;
  4. toggle Contact for Price, Out of Stock, discount off, then Unpublish, reloading the website after
     each change (unpublished → gone from the list, and its detail page shows "not found").
     The example LKR 2,500.00 − 10% = LKR 2,250.00 is used ONLY in the isolated tests; never publish it.
- **File changes on 2026-11-18 (website only; Backend and Admin source unchanged):**
  - `scripts/serve-static.mjs`: security headers re-read per request (stale-CSP fix);
  - `src/app/about/page.tsx`: valid `<dl>` in "Since 1997" (icon moved inside the `<dt>`, same layout);
  - `src/app/globals.css`, `src/components/ui/SectionHeading.tsx`: new `--color-gold-text` (#EFC95F,
    5.0:1 on forest) for the small dark-tone eyebrow text (gold-soft measured 4.49:1); the eyebrow
    rule line keeps gold-soft;
  - `src/app/contact/page.tsx` (contact method labels) and
    `src/components/services/ServicesShowcase.tsx` (active service title): h3 → h2 (they follow the h1);
  - tests: `a11y-responsive.spec.ts` (compact widths: Call lives in the menu, so the menu button must
    be on screen; axe excludes only the dimmed, aria-hidden, non-facing Services-ring cards),
    `brand-images.spec.ts` (select the storefront photo / the visible CTA image instead of the first
    `<img>`), `home-features.spec.ts` (static product-type card assertions run only on a build without
    `NEXT_PUBLIC_API_URL`; the showcase heading is h2).
- **Tests, 2026-11-18:**
  - Backend: typecheck, lint, build OK; unit 18/18; integration 29/29 (isolated embedded PostgreSQL;
    includes 2,500.00 − 10% = 2,250.00, invalid discounts rejected, Contact for Price, availability,
    drafts private, main/additional images, 0001→0002 on existing data);
  - Admin: typecheck, lint, build OK; Playwright 17 passed, 3 skipped by design (isolated stack:
    create/edit with price + discount + server preview, images, publish/unpublish, categories, brands,
    delivery areas, staff, editor restrictions, 320–1440 px);
  - Website: typecheck, lint, prettier, build OK; unit 24/24; Playwright (desktop Chrome + Pixel 7
    emulation) final full run 200 passed / 11 failed / 43 skipped. Of the 11, 2 were outdated tests
    (fixed, then passed) and 9 were timeouts under load (WebGL software rendering; all passed when
    re-run serially). Live catalogue 14/14; all axe pages and 320–1920 px responsive checks pass.
  - No physical iPhone/Safari testing was done (Chromium emulation only).
- **Remaining limitations:**
  - Services ring (Home): non-facing cards are dimmed to 0.45 opacity by the approved design
    (2.7–4.0:1). They are aria-hidden, not tabbable and inactive (WCAG 1.4.3 exemption), so they are
    excluded from the axe scan. If the owner prefers, raise their opacity instead.
  - Product-detail SEO: live products use `/products/item/?slug=…`, one static shell marked
    `noindex, follow`. Indexable per-product URLs are a separate task for the final SEO phase.
  - The full website suite is heavy (~13–19 min, WebGL in software); a few tests can time out under
    load and pass when re-run serially.
- **Database (0002, additive):**
  - `products`: `unit`, `price_lkr NUMERIC(12,2)`, `contact_for_price` (default true),
    `discount_type` (none/percentage/fixed), `discount_value`, `discount_enabled`,
    `discount_starts_on` / `discount_ends_on` (dates, inclusive, Asia/Colombo) and
    `availability` (default `on_request`);
  - `product_images.is_main`: one main image per product (unique partial index);
  - CHECK constraints: price ≥ 0; percentage > 0 and ≤ 100; fixed > 0 and ≤ price; a discount
    needs a price; no enabled discount with Contact for Price; start ≤ end;
  - existing rows keep their data and publication status. The live DB had 0 products and
    0 images at the last read-only check.
- **Backend:**
  - `src/catalogue/pricing.ts` is the single price calculation (BigInt cents). The admin list,
    admin detail, price preview and public API all use it;
  - public products return `unit`, `availability` and `price` only (`contactForPrice`,
    `original`, `discount` (active offers only), `final`), never the raw discount settings;
  - new endpoints: `POST /admin/products/price-preview` and
    `PATCH /admin/products/:id/images/:imageId` (alt text, make main). Upload takes `isMain=true`;
  - removing the main image promotes the next one;
  - unknown fields (e.g. a browser `finalPrice`) are rejected;
  - DB error 23502 is mapped to 400;
  - start-up check: the API refuses to start while migrations are pending.
- **Admin:**
  - Add/Edit Product gains unit (bag/sheet/piece suggestions), Price in LKR or Contact for
    Price, discount type/value, enable toggle, start/end dates and availability;
  - live **Price preview** (Original Price, Discount Amount, Final Selling Price, discount
    status) calculated by the API;
  - instant validation messages; invalid prices cannot be saved;
  - images: main badge, "make main", upload as main, alt-text edit;
  - product list shows unit, price or Contact for Price, active discount, final price and
    availability.
- **Website (still a static export):**
  - built with `NEXT_PUBLIC_API_URL`, `/products/` loads PUBLISHED products from the API in the
    browser (search, category, brand, pagination). Newly published products appear without a
    rebuild;
  - states: loading, empty ("Products are being added"), no match, and API unavailable
    ("temporarily unavailable" + retry). Nothing is substituted;
  - live detail page: `/products/item/?slug=<slug>` (one static shell, noindex), with images
    (main first), category and brand, unit, price/offer, availability and the existing
    WhatsApp/Call buttons;
  - category pages add a live product list (hidden while empty);
  - the 8 documented product-type pages and 7 category pages keep their URLs and content;
  - CSP `img-src` now includes the API origin (published images only; drafts return 404);
  - without `NEXT_PUBLIC_API_URL`, the previous static product-type catalogue is shown unchanged.
- **Not in 5A:** quotation forms, product-specific WhatsApp flows (5B/5C), cart, payment, POS,
  multilingual, WhatsApp AI.
- **Backups:** `D:\.tmp\pathirana-{web,backend,admin}-backup-batch5a-20261117-175330.tgz` (source;
  the backend one includes `.env`, so keep it private) and
  `D:\.tmp\pathirana-web-out-backup-batch5a-20261117.tgz` (previous `out/`).

## Codebases (all on D:)

| Folder                          | What                                                                          | Run                                                            |
| ------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `D:\Pathirana-Hardware-Web`     | Public website — Next.js 16 **static export** (no secrets, no staff features) | `npm run build`, then `node scripts/serve-static.mjs out 4173` |
| `D:\Pathirana-Hardware-Backend` | Website API — NestJS 11 + PostgreSQL (separate from the POS)                  | `npm run build && npm start` (port 4000)                       |
| `D:\Pathirana-Hardware-Admin`   | Staff admin — Next.js 16 server app (BFF)                                     | `npm run build && npm start` (port 4400)                       |

The POS system and its database are separate and must never be touched.

## Status

- **Website:** all approved pages are done. The Home page delivery checker calls the API when
  the site is built with `NEXT_PUBLIC_API_URL`; otherwise it shows the honest WhatsApp
  fallback. The animated truck uses SVG SMIL.
- **Backend (Batches 1–3 + Batch 4 additions):**
  - auth: Argon2id, JWT with `token_version` revocation, lockout, rate limits;
  - roles: admin and editor;
  - catalogue: categories, brands, products and images;
  - delivery areas, and an audit log.
  - Batch 4 added:
    - `GET /admin/dashboard`;
    - `PATCH /admin/staff/:id/role`;
    - `PATCH /admin/staff/:id/password`;
    - `POST /auth/password`;
    - `GET /admin/products/:id/images/:imageId` (staff preview);
    - the error filter now drains unread request bodies, so early rejects don't reset connections.
- **Admin (Batch 4):**
  - screens: login, dashboard, products (list, add, edit, images), categories, brands,
    delivery areas, staff (admin only) and settings (own password, sign out everywhere);
  - session: HttpOnly SameSite=Strict cookie, same-origin gateway `/api/backend/*` with CSRF
    header plus Origin check.

## Database — set up 2026-11-17 (owner-approved)

- **Server:** PostgreSQL 18.7 (official EnterpriseDB binaries, signature verified), installed
  without admin rights:
  - program: `D:\PostgreSQL\18`;
  - data: `D:\PostgreSQL\data18`;
  - listens on localhost:5432 only, scram-sha-256 passwords.
- **Starting and stopping:** it is not a Windows service and does not auto-start. Run
  `D:\PostgreSQL\start-postgres.cmd` after a reboot; stop it with `stop-postgres.cmd`.
- **Database and role:**
  - `pathirana_website`: UTF-8, locale C (same as the tests);
  - owner role `pathirana_web`: no superuser, no create-DB, no create-role;
  - `CONNECT` is revoked from PUBLIC.
- **Secrets** (never print them):
  - the superuser password is in `D:\PostgreSQL\secrets\` (ACL: owner's Windows account only);
  - the app password and `JWT_SECRET` are in `Backend\.env` (same ACL, `NODE_ENV=production`,
    CORS = the website on 4173).
- **Migration:** `0001_initial_schema.sql` was applied after a dry run. All tables were empty
  afterwards. `0002_product_pricing.sql` (Batch 5A) was applied on 2026-11-18 after a verified backup
  (see Batch 5A above).
- **First administrator:** the owner creates it privately in their own terminal:
  `npm run admin:create -- --email=… --name="…" --confirm-database=pathirana_website`.
- **Optional**, owner's decision only: `npm run seed:catalogue -- --confirm-database=pathirana_website`
  (confirmed categories, brands and product types; unpublished).
- **The public website** must be built with `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000` to
  use the live API (the current `out/` is built that way).
- **Running the Admin e2e tests:** first stop the live Admin app (4400) and anything on 4310.
  `tests/stack.ts` refuses to start while those ports are busy.

## Tests (all isolated; throwaway embedded PostgreSQL)

- Backend:
  - `npm run typecheck && npm run lint && npm test`;
  - last run (Batch 5A): 47/47 (18 unit + 29 integration, incl. `test/pricing.e2e-spec.ts` and a
    0001→0002 migration check on existing data).
- Admin:
  - `npm run typecheck && npm run lint && npm run build && npm run test:e2e`;
  - last run (Batch 5A): 17 passed, 3 skipped by design (desktop-only);
  - with the live admin running, use `ADMIN_DIST_DIR=.next-e2e E2E_ADMIN_PORT=4410` for both
    `npm run build` and `npm run test:e2e` (the live `.next` and port 4400 are left alone).
- Website:
  - `npm run typecheck && npm run lint && npm run build`;
  - delivery tests: `tests/e2e/delivery-areas.spec.ts`;
  - live catalogue: `tests/e2e/live-catalogue.spec.ts` (API build; mocked API shapes): 14/14;
  - the earlier pre-existing failures (About `definition-list`, header phone link at narrow widths,
    About photo check, eyebrow contrast, heading order) were fixed on 2026-11-18 (see Batch 5A).
    Tests use 4173/4174 (`navigation.spec.ts` expects 4173); avoid browser-blocked ports.
  - before `npm run test:e2e`, make sure no OLD preview is still running on 4173 (Playwright reuses
    it); set `PLAYWRIGHT_BROWSERS_PATH=D:/.dev-cache/playwright` and `NEXT_PUBLIC_API_URL` as built.

## Rules carried forward

- Real business data only: no invented prices, stock, SKUs, delivery areas, fees or reviews.
- Original logos only; never regenerate or recolour them.
- Prices and discounts only as approved by the shop (Batch 5A). No quotations yet (5B/5C), no
  multilingual site, no WhatsApp AI, cart, payment or POS link.
- Keep work on D:
  - `TEMP=D:/.tmp`, `npm_config_cache=D:/.npm-cache`,
    `PLAYWRIGHT_BROWSERS_PATH=D:/.dev-cache/playwright`;
  - backups go in `D:\.tmp\pathirana-*-backup-*`; never overwrite them.
- Avoid browser-blocked ports, such as 4190, for local API URLs.
