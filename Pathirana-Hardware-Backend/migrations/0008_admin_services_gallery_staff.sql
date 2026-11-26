-- Admin portal: Services and Gallery management, secure staff password set-up links,
-- non-negative category display order, and retirement of quotation email notifications.
--
-- ADDITIVE: three new tables and one new CHECK constraint. No existing table, column or row
-- is removed. The only change to existing rows: quotation email jobs still waiting to be sent
-- are marked "cancelled" (client decision 2026-11-20: no quotation emails) so they can never be
-- delivered later; their rows and history are kept.
--
-- Seed data: the six services already approved and published on the website (copied word for
-- word from Pathirana-Hardware-Web/src/content/services.ts). No other business data is inserted.
--
-- Rollback:
--   DROP TABLE staff_password_tokens; DROP TABLE gallery_photos; DROP TABLE services;
--   ALTER TABLE categories DROP CONSTRAINT categories_sort_order_nonnegative;
--   -- (cancelled notifications stay cancelled: email sending has been removed from the code)
--   DELETE FROM schema_migrations WHERE version = '0008_admin_services_gallery_staff.sql';

-- ── Services ────────────────────────────────────────────────────────────────
CREATE TABLE services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  title         text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  short_title   text NOT NULL CHECK (length(btrim(short_title)) BETWEEN 1 AND 60),
  summary       text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 300),
  description   text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 3000),
  how_to_ask    text NOT NULL DEFAULT '' CHECK (length(how_to_ask) <= 500),
  enquire_about text[] NOT NULL DEFAULT '{}' CHECK (cardinality(enquire_about) <= 10),
  share         text NOT NULL DEFAULT '' CHECK (length(share) <= 200),
  icon          text NOT NULL CHECK (icon IN ('bricks', 'truck', 'boxes', 'bookmark', 'lightbulb', 'hardhat')),
  kind          text NOT NULL CHECK (kind IN ('materials', 'delivery', 'bulk', 'reservations', 'guidance', 'contractor')),
  sort_order    integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9999),
  is_published  boolean NOT NULL DEFAULT false,
  image_key     text,
  image_width   integer,
  image_height  integer,
  image_alt     text CHECK (image_alt IS NULL OR length(image_alt) <= 250),
  translations  jsonb NOT NULL DEFAULT '{}'::jsonb CONSTRAINT services_translations_shape CHECK (
    jsonb_typeof(translations) = 'object'
    AND (translations - ARRAY['ta', 'si']) = '{}'::jsonb
    AND length(translations::text) <= 20000
  ),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_image_complete CHECK (
    (image_key IS NULL AND image_width IS NULL AND image_height IS NULL)
    OR (image_key IS NOT NULL AND image_width > 0 AND image_height > 0)
  )
);
CREATE UNIQUE INDEX services_slug_key ON services (slug);
CREATE UNIQUE INDEX services_image_key ON services (image_key) WHERE image_key IS NOT NULL;
CREATE INDEX services_published_idx ON services (sort_order, title) WHERE is_published;
CREATE TRIGGER services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO services (slug, title, short_title, summary, description, how_to_ask, enquire_about, share, icon, kind,
                      sort_order, is_published) VALUES
  ('building-material-supply', 'Building Material Supply', 'Building Material Supply', 'Cement, steel, plywood, doors, windows and sanitary products.', 'Hardware and construction material supply, including cement, steel products such as TOR bars and box bars, plywood, doors, windows and sanitary products.', 'Tell us the items, sizes and quantities you need, and we will confirm availability.',
   ARRAY['Whether the materials you need are available', 'Current prices for the items on your list', 'Suitable alternatives if an item is not available', 'Collecting your materials from the store']::text[], 'the items, sizes and quantities you need', 'bricks', 'materials', 0, true),
  ('home-site-delivery', 'Home / Site Delivery', 'Home / Site Delivery', 'Ask about arranging delivery to your home or site.', 'Customers can enquire about arranging material deliveries to their homes or construction sites.', 'Share your order and location — the store will confirm whether delivery can be arranged and any charges.',
   ARRAY['Whether delivery can be arranged to your location', 'Any delivery charges for your order', 'When a delivery could be scheduled', 'Access details for your home or site']::text[], 'your order and the delivery location', 'truck', 'delivery', 10, true),
  ('bulk-orders', 'Bulk Orders', 'Bulk Orders', 'Enquire about larger-quantity material orders.', 'Customers can enquire about larger-quantity hardware and building material orders.', 'Send the list of items and quantities you need; the store will confirm availability and details.',
   ARRAY['Availability for larger quantities', 'Pricing for your full material list', 'Supplying an order in stages', 'Delivery for larger orders']::text[], 'your list of items and quantities', 'boxes', 'bulk', 20, true),
  ('product-reservations', 'Product Reservations', 'Product Reservations', 'Contact us about reserving the materials you need.', 'Customers can contact the shop to enquire about reserving the materials they need.', 'Call or WhatsApp the store to ask whether the items can be reserved and for how long.',
   ARRAY['Whether an item can be reserved', 'How long a reservation can be held', 'Any payment needed to reserve', 'Collecting or delivering reserved items']::text[], 'the items you would like to reserve and when you need them', 'bookmark', 'reservations', 30, true),
  ('product-advice', 'Product Advice & Guidance', 'Product Advice', 'Get guidance when choosing hardware and materials.', 'Customers can request guidance when selecting hardware and building materials.', 'Describe your job or project and we will help you choose suitable products.',
   ARRAY['Which materials suit your job', 'Comparing the options available at the store', 'The quantities you may need', 'Related items for your project']::text[], 'a short description of your job or project', 'lightbulb', 'guidance', 40, true),
  ('contractor-support', 'Contractor & Project Support', 'Contractor Support', 'Material enquiries for building projects.', 'Contractors and construction customers can enquire about material requirements for their building projects.', 'Share your project''s material list or requirements and the store will get back to you.',
   ARRAY['Availability for your project''s material list', 'Pricing for project quantities', 'Supplying materials as your project progresses', 'Delivery to your construction site']::text[], 'your project''s material list or requirements', 'hardhat', 'contractor', 50, true)
;

-- ── Gallery ─────────────────────────────────────────────────────────────────
CREATE TABLE gallery_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key   text NOT NULL,
  width         integer NOT NULL CHECK (width > 0),
  height        integer NOT NULL CHECK (height > 0),
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  title         text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  caption       text CHECK (caption IS NULL OR length(caption) <= 300),
  alt_text      text NOT NULL CHECK (length(btrim(alt_text)) BETWEEN 1 AND 250),
  collection    text CHECK (collection IS NULL OR length(btrim(collection)) BETWEEN 1 AND 60),
  sort_order    integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9999),
  is_published  boolean NOT NULL DEFAULT false,
  translations  jsonb NOT NULL DEFAULT '{}'::jsonb CONSTRAINT gallery_translations_shape CHECK (
    jsonb_typeof(translations) = 'object'
    AND (translations - ARRAY['ta', 'si']) = '{}'::jsonb
    AND length(translations::text) <= 4000
  ),
  created_by    uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gallery_photos_storage_key ON gallery_photos (storage_key);
CREATE INDEX gallery_photos_published_idx ON gallery_photos (sort_order, created_at) WHERE is_published;
CREATE TRIGGER gallery_photos_updated_at BEFORE UPDATE ON gallery_photos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Staff password set-up / reset links (hash only, single use, short-lived) ─
CREATE TABLE staff_password_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  token_hash  text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  purpose     text NOT NULL CHECK (purpose IN ('setup', 'reset')),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_by  uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX staff_password_tokens_hash ON staff_password_tokens (token_hash);
CREATE INDEX staff_password_tokens_staff_idx ON staff_password_tokens (staff_id, created_at DESC);

-- ── Category display order: whole numbers 0 or more (existing rows are checked) ─
ALTER TABLE categories ADD CONSTRAINT categories_sort_order_nonnegative CHECK (sort_order >= 0);

-- ── Retire quotation email notifications: waiting jobs can never be sent ────
UPDATE quotation_notifications
   SET status = 'cancelled', locked_until = NULL,
       last_error = 'Quotation email notifications retired (client decision 2026-11-20).'
 WHERE status = 'pending';
