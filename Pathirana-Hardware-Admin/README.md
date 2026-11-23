# Pathirana Hardware — Staff Admin

Separate Next.js 16 application for staff. It is **not** part of the public static website
(`D:\Pathirana-Hardware-Web`) and has no database access of its own: everything goes through
the website API (`D:\Pathirana-Hardware-Backend`).

## Run

```bash
npm install
cp .env.example .env.local      # BACKEND_API_URL, ADMIN_SESSION_MAX_AGE, ADMIN_COOKIE_SECURE, ADMIN_TRUST_PROXY
npm run build && npm start      # http://localhost:4400  (dev: npm run dev)
```

The API must be running (default `http://127.0.0.1:4000`).

## How sign-in is secured

- `POST /api/session` sends the credentials to the API and stores the returned token **only**
  in an `HttpOnly`, `SameSite=Strict` cookie (`Secure` when `ADMIN_COOKIE_SECURE=true`).
  Page scripts can never read it.
- The browser calls `/api/backend/<path>` (same origin). That route attaches the token and
  forwards the call to the API's staff endpoints only (allow-list).
- CSRF: state-changing calls need the `x-ph-admin: 1` header, and the `Origin` must match this
  site. Together with the `SameSite=Strict` cookie, this blocks cross-site requests.
- `src/proxy.ts` sends visitors without a session to `/login`. The `(admin)` layout validates
  the session with the API on every page load, and the API enforces roles on every call.
- Sign out (`DELETE /api/session`) revokes **all** of the account's tokens on the API.
- When an API call returns 401, the cookie is cleared and the visitor returns to `/login`.
- `ADMIN_TRUST_PROXY=true` only behind a trusted reverse proxy. The last `X-Forwarded-For`
  hop is then forwarded, so the API rate-limits sign-ins per device; the API also needs
  `TRUST_PROXY=true`.

## Screens

`/login` · `/dashboard` · `/products` · `/products/new` · `/products/[id]/edit` ·
`/categories` · `/brands` · `/delivery-areas` · `/staff` (admins only) · `/settings`

Only fields the API supports are shown. There are no price, stock, SKU or dimension fields.
The brand logos in `public/brands/` are the client's original files, copied unmodified. The
logos in `public/brand/` are the website's processed logo files: the original logo on a
transparent background, plus the cream-lettering version the website uses on dark green.

## Tests

```bash
npm run typecheck && npm run lint && npm run build
npm run test:e2e
```

The end-to-end tests start an isolated stack: a throwaway embedded PostgreSQL, the compiled
API (port 4310) and this app (port 4400). They create test-only staff in that throwaway
database and delete everything afterwards. Build the API first (`npm run build` in the
backend).
