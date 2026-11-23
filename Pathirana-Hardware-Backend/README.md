# Pathirana Hardware — Website API

Separate NestJS + PostgreSQL backend for the static website
(`D:\Pathirana-Hardware-Web`). It is **not** the POS system and must use its own
database.

Scope (batches 1–3): staff authentication, product categories / brands /
products / product images, and delivery areas. No quotations, offers, ordering
or WhatsApp automation.

## Setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, CORS_ORIGINS
npm run db:migrate          # shows pending migrations (read-only)
```

Applying migrations, creating the first admin and loading the catalogue are
**explicit** steps that must name the target database:

```bash
npm run db:migrate -- --apply --confirm-database=pathirana_website
npm run admin:create -- --email=owner@example.com --name="Full Name" --confirm-database=pathirana_website
npm run seed:catalogue -- --confirm-database=pathirana_website   # optional
npm run build && npm start
```

- The database must be a dedicated, **UTF-8** PostgreSQL database. Migration
  refuses to run on a database that contains other tables (e.g. the POS).
- `admin:create` asks for the password at a hidden prompt (or reads
  `ADMIN_PASSWORD` once) and refuses if an active admin already exists.
- `seed:catalogue` loads only the confirmed categories, brands and product
  types. Product types are left **unpublished**. It creates no prices, stock,
  SKUs, dimensions or product–brand links.
- No delivery areas are created anywhere; staff add them once confirmed.

### Hosted database (Supabase) — connection check only

Keep the hosted database's settings in the git-ignored `.env.supabase` (`DATABASE_URL` = Session
Pooler URI, `DATABASE_SSL=true`, `DATABASE_SSL_CA_FILE=./certs/supabase-ca.crt`; `certs/` is
git-ignored too). `.env` keeps the local database, and the API uses only `.env`.

```bash
npm run db:check -- --env-file=.env.supabase   # read-only: TLS, version, empty?, pending migrations
```

- TLS always verifies the certificate chain and host name; with a CA file only that CA is trusted.
  `sslmode`/`sslrootcert` in the URL are ignored when `DATABASE_SSL=true` (they would otherwise
  override the pinned CA).
- Scripts refuse to connect to a non-local host without TLS. `--env-file` works for every script
  (e.g. `db:migrate`), and write commands still need `--confirm-database=<name>`.

### Moving the database to Supabase (schema by migrations, data by copy)

A PostgreSQL 18 dump is NOT restored into Supabase (PostgreSQL 17). The schema is created by
the same migrations, then only rows are copied and verified:

```bash
npm run db:harden   -- --env-file=.env.supabase --apply --confirm-database=postgres   # close API roles first
npm run db:migrate  -- --env-file=.env.supabase --apply --confirm-database=postgres   # 0001–0005
npm run db:harden   -- --env-file=.env.supabase --apply --confirm-database=postgres   # revoke + RLS on new tables
npm run db:transfer -- --to-env-file=.env.supabase                                     # read-only pre-checks
npm run db:transfer -- --to-env-file=.env.supabase --apply --confirm-database=postgres
```

- `db:transfer` reads the source (`.env`) in a read-only snapshot and writes the destination in
  one transaction (primary keys, timestamps, password hashes, identity positions and migration
  history kept); it commits only if every table's fingerprint matches, and refuses a
  non-empty destination or one that still grants tables to `anon`/`authenticated`/`service_role`.
- Rollback of the hosted copy: `npm run db:drop-website -- --env-file=.env.supabase --apply
--confirm-database=postgres --drop-website-schema` (website objects in `public` only; refuses
  the local database). Uploaded images stay in `UPLOAD_DIR`; they are not in the database.

### Media storage (local disk or Supabase Storage)

`MEDIA_STORAGE=local` (default) keeps files under `UPLOAD_DIR`. `MEDIA_STORAGE=supabase` stores them in
two **private** Supabase buckets — `SUPABASE_CATALOGUE_BUCKET` (products, brands, categories) and
`SUPABASE_PRIVATE_BUCKET` (customer quotation photos) — using the server-only
`SUPABASE_SECRET_KEY`. Nothing is public in Storage: every image is streamed by the API after
its own check (published product in an active category, active brand/category, or a signed-in
staff member for quotation photos), so public URLs stay `/api/v1/...` and drafts never leak.
Uploads are create-only (no overwrite); a storage outage returns 503 and writes nothing.

```bash
npm run storage:setup -- --env-file=.env.supabase                        # report buckets
npm run storage:setup -- --env-file=.env.supabase --apply --create-buckets
npm run storage:migrate-local -- --env-file=.env.supabase                # plan (read-only)
npm run storage:migrate-local -- --env-file=.env.supabase --apply --upload-media
```

`storage:migrate-local` copies the local files referenced by the cloud database under the SAME
names (no database change), skips identical objects, never replaces different ones, verifies
each upload by SHA-256 and never deletes local files.

### Cloud-connected instance

`ENV_FILE=.env.supabase` is loaded before `.env` (its values win). A separate build keeps the
current `dist/` untouched: `npx tsc -p tsconfig.build.json --outDir dist-cloud`, then
`ENV_FILE=.env.supabase PORT=4100 npm run start:cloud`.

## Security

- Argon2id password hashing; minimum 12-character passwords.
- JWT (HS256, issuer/audience checked, `JWT_EXPIRES_IN`, default 8h). Each
  token carries the staff `token_version`; logout, deactivation or a role
  change increments it, so all earlier tokens stop working immediately.
- Login: 5 requests/minute per client, plus a 15-minute account lock after 5
  failures. The response never reveals whether an account exists or is locked.
- Roles: `admin` (everything, incl. staff accounts) and `editor` (catalogue and
  delivery areas). See `src/auth/roles.ts`.
- Helmet headers, exact-origin CORS (`CORS_ORIGINS`), a 120 req/min default
  rate limit, whitelist validation (unknown fields are rejected), one error
  format with a request ID, no stack traces or SQL in responses, and logs
  without headers, bodies or query strings.
- Audit log (`audit_log`) for every admin change.
- Images: JPEG/PNG/WebP only, checked by decoding (not by name or MIME), size
  limited by `MAX_UPLOAD_MB`, re-encoded to WebP (metadata stripped), saved
  under server-generated names outside any web root, and served only for
  published products in active categories.

## API (`/api/v1`, health at `/api/health`)

| Public                                                      |                                    |
| ----------------------------------------------------------- | ---------------------------------- |
| `GET /categories`, `GET /brands`                            | active only                        |
| `GET /products?q=&category=&brand=&page=&limit=`            | published, searchable, filterable  |
| `GET /products/:slug`, `GET /product-images/:id?size=thumb` | main image first                   |
| `GET /delivery-areas?q=`                                    | active areas (empty until listed)  |
| `GET /delivery-areas/check?area=`                           | `{ supported, area, areasListed }` |
| `GET /services`, `GET /service-images/:key?size=thumb`      | published only, staff order        |
| `GET /gallery`, `GET /gallery-images/:id?size=thumb`        | published only; hidden photos 404  |
| `GET/POST /auth/password-setup` (`token`, `password`)       | one-time staff password link       |

| Staff (Bearer token)                                                                                                        |                                          |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`                                                                     |                                          |
| `GET/POST /admin/staff`, `PATCH /admin/staff/:id` (name/email), `PATCH …/:id/status`, `…/:id/role`                          | admin                                    |
| `POST /admin/staff/:id/password-link` (`purpose: setup                                                                      | reset`): one-time 24 h link, hash stored | admin |
| `GET/POST /admin/categories`, `PATCH /admin/categories/:id`, `PATCH …/:id/status`                                           |                                          |
| `GET/POST /admin/brands`, `PATCH /admin/brands/:id`, `PATCH …/:id/status`                                                   |                                          |
| `GET/POST /admin/products`, `GET/PATCH /admin/products/:id`, `PATCH …/:id/publication`                                      |                                          |
| `POST /admin/products/:id/images` (multipart `file` + `altText` [+ `isMain=true`])                                          |                                          |
| `PATCH /admin/products/:id/images/:imageId` (`altText`, `isMain: true`), `DELETE …/:imageId`                                |                                          |
| `POST /admin/products/price-preview` (unsaved price fields → calculated price, never saves)                                 |                                          |
| `GET/POST /admin/delivery-areas`, `PATCH …/:id`, `PATCH …/:id/status`, `DELETE …/:id` (archives)                            |                                          |
| `POST /admin/delivery-areas/:id/restore` (`isActive`, default true): same record back, audited                              | admin                                    |
| `GET/POST /admin/services`, `PATCH …/:id`, `PATCH …/:id/publication`, `POST/PATCH/DELETE …/:id/image`                       |                                          |
| `GET/POST /admin/gallery` (multipart, starts hidden), `PATCH …/:id`, `…/:id/publication`, `PUT …/:id/image`, `DELETE …/:id` |                                          |

## Quotation emails — retired (migration 0008)

Quotation email notifications were removed at the client's request (2026-11-20). New requests
queue no email, there is no sending worker and no email provider or Resend dependency, and the
Admin has no notification settings. Migration 0008 marks any still-pending rows in
`quotation_notifications` as `cancelled` (never sent); the table and its history are kept.
Customers are offered a prefilled WhatsApp message after their request is saved.

## Services, gallery and staff onboarding (migration 0008)

- `services`: the six approved website services are seeded from the website's own content;
  staff edit text, order, Tamil/Sinhala, image and publication. Only published ones are public.
- `gallery_photos`: uploads are decoded, resized to WebP (2000 px / 640 px), stored under unique
  names and start **hidden**; hidden photos are never served publicly. Deleting removes the
  record first, then the files.
- `staff_password_tokens`: admins add staff without a password; the person opens a one-time
  link (24 h, only its SHA-256 hash is stored, earlier links are voided) and chooses their own.
  The last active admin cannot be deactivated or demoted.
- `categories.sort_order` gains a `CHECK (sort_order >= 0)`.

## Prices, discounts and availability (Batch 5A, migration 0002)

- Products have `unit`, `priceLkr` (NUMERIC(12,2), sent as a string such as `"2500.00"`),
  `contactForPrice`, `discountType` (`none` | `percentage` | `fixed`), `discountValue`,
  `discountEnabled`, optional `discountStartsOn` / `discountEndsOn` (inclusive dates,
  Sri Lanka time) and `availability` (`available` | `out_of_stock` | `on_request`).
- `src/catalogue/pricing.ts` is the ONE price calculation (exact integer cents). Public
  products expose only its result, `price: { contactForPrice, original, discount, final }`:
  Contact for Price shows no amount, and a disabled, scheduled or expired discount is not
  shown. Unknown body fields (e.g. a browser-calculated final price) are rejected.
- Database CHECK constraints repeat the rules (non-negative price, percentage 0–100,
  fixed ≤ price, dates in order, no discount with Contact for Price).
- The API refuses to start while migrations are pending.

## Admin application

The staff UI is `D:\Pathirana-Hardware-Admin`. It calls this API server-to-server, so no CORS entry is needed for it. Behind a reverse proxy, run both with `TRUST_PROXY=true` / `ADMIN_TRUST_PROXY=true` so sign-ins are rate-limited per device.

## Connecting the website

Build the site with `NEXT_PUBLIC_API_URL=https://api.your-domain.lk`. This adds
the API origin to the site's CSP `connect-src`. Then add the site's origin to the
API's `CORS_ORIGINS`. Avoid ports that browsers block for fetch, such as 4190.

## Tests

```bash
npm run typecheck && npm run lint && npm test
```

Integration tests start an isolated, throwaway PostgreSQL (`embedded-postgres`)
in the temp directory, apply the real migrations, and delete everything
afterwards. No other database is touched.
