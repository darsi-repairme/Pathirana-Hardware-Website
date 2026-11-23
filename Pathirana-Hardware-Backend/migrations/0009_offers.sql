-- Offers & promo codes, managed in the Admin and shown in the website header.
--
-- ADDITIVE: three new tables and three OPTIONAL columns on quotation_requests (all NULL for every
-- existing request). No existing row, price or discount changes. Nothing is inserted: offers exist
-- only once staff create and publish them.
--
-- Business rules (no online checkout): a promo code is quoted by the customer in a quotation request.
-- The API records whether the code was valid for that request; staff confirm the final price manually.
-- Offer discounts are NOT applied to product prices and do not stack with product discounts
-- automatically.
--
-- Rollback:
--   ALTER TABLE quotation_requests DROP COLUMN promo_status, DROP COLUMN promo_offer_id, DROP COLUMN promo_code;
--   DROP TABLE offer_categories; DROP TABLE offer_products; DROP TABLE offers;
--   DELETE FROM schema_migrations WHERE version = '0009_offers.sql';

CREATE TABLE offers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  -- Short headline of the benefit, e.g. "10% off" or "Free delivery in Bangadeniya".
  benefit          text NOT NULL DEFAULT '' CHECK (length(benefit) <= 120),
  description      text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  discount_type    text NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'fixed')),
  discount_value   numeric(12, 2),
  -- Stored in upper case; customers may type it in any case.
  promo_code       text CHECK (promo_code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
  min_purchase_lkr numeric(12, 2) CHECK (min_purchase_lkr IS NULL OR min_purchase_lkr >= 0),
  -- 'all': every product; 'selected': only the products / categories linked below.
  applies_to       text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'selected')),
  starts_on        date,
  ends_on          date,
  sort_order       integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9999),
  is_published     boolean NOT NULL DEFAULT false,
  translations     jsonb NOT NULL DEFAULT '{}'::jsonb CONSTRAINT offers_translations_shape CHECK (
    jsonb_typeof(translations) = 'object'
    AND (translations - ARRAY['ta', 'si']) = '{}'::jsonb
    AND length(translations::text) <= 8000
  ),
  created_by       uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_discount_valid CHECK (
    (discount_type = 'none' AND discount_value IS NULL)
    OR (discount_type = 'percentage' AND discount_value > 0 AND discount_value <= 100)
    OR (discount_type = 'fixed' AND discount_value > 0)
  ),
  CONSTRAINT offers_dates_valid CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX offers_promo_code_key ON offers (promo_code) WHERE promo_code IS NOT NULL;
CREATE INDEX offers_published_idx ON offers (sort_order, created_at) WHERE is_published;
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE offer_products (
  offer_id   uuid NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, product_id)
);
CREATE INDEX offer_products_product_idx ON offer_products (product_id);

CREATE TABLE offer_categories (
  offer_id    uuid NOT NULL REFERENCES offers (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, category_id)
);
CREATE INDEX offer_categories_category_idx ON offer_categories (category_id);

-- The code a customer quoted, and what the API found when the request was saved.
ALTER TABLE quotation_requests
  ADD COLUMN promo_code text CHECK (promo_code IS NULL OR promo_code ~ '^[A-Z0-9][A-Z0-9-]{0,31}$'),
  ADD COLUMN promo_offer_id uuid REFERENCES offers (id) ON DELETE SET NULL,
  ADD COLUMN promo_status text CHECK (promo_status IN ('valid', 'not_eligible', 'expired', 'unknown')),
  ADD CONSTRAINT quotation_requests_promo_pair CHECK ((promo_code IS NULL) = (promo_status IS NULL));
