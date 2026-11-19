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

| Staff (Bearer token)                                                                             |       |
| ------------------------------------------------------------------------------------------------ | ----- |
| `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`                                          |       |
| `GET/POST /admin/staff`, `PATCH /admin/staff/:id/status`                                         | admin |
| `GET/POST /admin/categories`, `PATCH /admin/categories/:id`, `PATCH …/:id/status`                |       |
| `GET/POST /admin/brands`, `PATCH /admin/brands/:id`, `PATCH …/:id/status`                        |       |
| `GET/POST /admin/products`, `GET/PATCH /admin/products/:id`, `PATCH …/:id/publication`           |       |
| `POST /admin/products/:id/images` (multipart `file` + `altText` [+ `isMain=true`])               |       |
| `PATCH /admin/products/:id/images/:imageId` (`altText`, `isMain: true`), `DELETE …/:imageId`     |       |
| `POST /admin/products/price-preview` (unsaved price fields → calculated price, never saves)      |       |
| `GET/POST /admin/delivery-areas`, `PATCH …/:id`, `PATCH …/:id/status`, `DELETE …/:id` (archives) |       |

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
