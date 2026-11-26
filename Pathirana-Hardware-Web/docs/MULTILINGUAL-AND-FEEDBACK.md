# Multilingual website (English · தமிழ் · සිංහල) and customer feedback

Last updated: 2026-11-20. Work is on the `dev` branch, **not committed, not deployed**.

## 1. How the languages work

- The site is a static export, so language switching happens in the browser: the URL does not change, there
  is no reload, and the page, scroll position, product and any half-filled form are kept.
- Choice is remembered in `localStorage` (`ph-lang`). First visit = English. A shareable `?lang=ta` / `?lang=si`
  / `?lang=en` on any URL selects (and remembers) a language.
- A tiny inline script in `<head>` (`src/i18n/config.ts → LOCALE_BOOT_SCRIPT`) sets `<html lang>` before paint
  and briefly hides the English HTML for returning Tamil / Sinhala visitors so they never see a flash of
  English (always revealed within 1.8 s, even if JavaScript fails). It is hashed into the CSP automatically.
- Selector: compact menu on 1024–1535 px, full `EN · தமிழ் · සිංහල` control from 1536 px, and a three-button
  selector at the top of the phone/tablet menu.
- Fonts: Noto Sans / Noto Serif Tamil and Sinhala are self-hosted and split by Unicode range — English visitors
  download nothing extra. Letter-spacing is switched off and line-height raised for Tamil / Sinhala
  (`globals.css`, section "Tamil (ta) and Sinhala (si)").

### Translation files (the website's own text)

`src/i18n/messages/*.ts` — keyed by the exact English text: `"English": ["Tamil", "Sinhala"]`.

- Anything without an entry shows in **English** — a visitor can never see a key or a blank.
- Components use `<T>English</T>` (server components), `t("English")` (client components), `TRich` for
  sentences containing links, and `tx()` inside shared UI (buttons, headings, eyebrows).
- Proper names, the phone number, email, URLs, brand names and LKR prices are never translated.
- `npm run test:unit` checks every entry has both languages in the right script and identical `{placeholders}`.
- `node tests/tools/i18n-audit.mjs http://localhost:3000 ta` lists any visible text still in English
  (result on 2026-11-20: **0** on all 11 main pages, in both languages).

**REVIEW BEFORE LAUNCH:** the Tamil and Sinhala wording was written carefully but has **not** been checked by a
native speaker. Please have both reviewed (especially the legal-style consent texts and the WhatsApp
messages). Corrections are one-line edits in `src/i18n/messages/`.

Not translated on purpose: the three legal pages (Privacy, Refund, Terms) — they are unapproved drafts; the
Gallery page body; staff-entered image descriptions.

### Search engines

The HTML is English (the default) on one set of URLs, so `hreflang` alternates are **not** added: there are no
separate Tamil / Sinhala URLs for search engines to index. Adding them would need locale-prefixed routes
(`/ta/…`, `/si/…`) and a larger build — a client decision for later. `<html lang>` and the browser tab title
follow the chosen language.

## 2. Dynamic content (Admin → website)

Migration **0006_content_translations.sql** (additive) adds a `translations` column (JSON, default `{}`) to
`products`, `categories` and `delivery_areas`. English stays in the existing columns.

| Record        | Translatable fields                                  |
| ------------- | ---------------------------------------------------- |
| Product       | name, short summary, description, search words       |
| Category      | name, description                                    |
| Delivery area | area name (also accepted by the area checker), notes |

Brands have no description field, so nothing to translate (brand names stay as they are).

**Staff:** open a product / category / delivery area in the Admin dashboard → **Website languages** →
"Add Tamil / Sinhala text" → Tamil and Sinhala tabs show the English text for reference. Leave a field empty to
show English. Nothing is machine-translated, and prices, IDs, slugs and images are shared by all languages.
Search on the website also matches the Tamil / Sinhala names and search words.

## 3. WhatsApp messages

`src/lib/product-enquiry.ts` holds the English (unchanged, approved) template and faithful Tamil / Sinhala
versions; the product name is the translated one when staff entered it; price after discount or "Contact for
Price" in the chosen language; quantity and location stay editable placeholders; nothing is sent automatically.
The general "I would like to enquire about …" message (`business.ts`) and the quotation summary message
(`lib/quotation.ts`) follow the language too. Still pending from before: written client approval of the
"delivery charges" wording.

## 4. Customer feedback

Migration **0007_customer_feedback.sql** (additive) creates `customer_feedback` (RLS enabled, no policies).

- Website: "Share Your Feedback" on the Home page (What Our Customers Say) — name as shown, 1–5 stars, message,
  optional town, consent (required). No account, phone or email. Validation in the browser and the API,
  honeypot, links refused, 4 submissions / 10 min per client, duplicate protection (same form, or same name +
  message within 24 h). The thank-you message appears only after the API confirms it was saved.
- Every submission is **Pending**. Only **Approved** feedback is returned by `GET /api/v1/feedback`; reviews are
  shown exactly as written, with `lang` set to the customer's language and a "Written in Tamil/Sinhala" note when
  viewed in another language. Nothing is ever translated or edited. With none approved, an honest empty state.
- Admin → **Customer Feedback**: counts (Pending / Approved / Rejected), filters, details, Approve / Reject /
  Hide with confirmation and an optional internal note (never public). Restore (hidden → approved) is
  admin-only. All actions are audit-logged; the dashboard shows "Feedback Awaiting Review".

## 5. Before this goes live (needs approval)

1. **Back up** the permanent database.
2. Apply migrations: `npm run db:migrate -- --apply --confirm-database=<name>` in the backend
   (applies 0006 then 0007; both are additive, rollback SQL is in each file's header).
3. Then rebuild and restart the API (it refuses to start while migrations are pending — so **do not restart the
   current API before step 2**), rebuild/restart the Admin, rebuild the website.
4. Native-speaker review of the Tamil and Sinhala text.

## 6. Tests (all on isolated, throwaway databases)

- Backend: `npm test` — new `test/feedback.e2e-spec.ts`, `test/translations.e2e-spec.ts`.
- Website: `npm run test:unit` (incl. `tests/unit/i18n.test.ts`); live stack `tests/live-stack/i18n-feedback.spec.ts`.
- Admin: `tests/admin.spec.ts` → "Customer feedback (editor/admin)" and the category translation test.
