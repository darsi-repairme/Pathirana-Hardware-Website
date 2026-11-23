-- Batch 5A — unit of sale, LKR price, discount and availability on products;
-- a designated main image per product.
--
-- ADDITIVE ONLY: no table, column or row is dropped or rewritten. Existing
-- products keep their data and publication status and start as
-- "Contact for Price", no discount, availability "On Request" — nothing is
-- claimed until staff enter it. Money is NUMERIC (exact), never float.
-- The authoritative price calculation is src/catalogue/pricing.ts; these
-- constraints are the database backstop for the same rules.

ALTER TABLE products
  ADD COLUMN unit               text CHECK (length(unit) BETWEEN 1 AND 40),
  ADD COLUMN price_lkr          numeric(12, 2) CHECK (price_lkr >= 0),
  ADD COLUMN contact_for_price  boolean NOT NULL DEFAULT true,
  ADD COLUMN discount_type      text NOT NULL DEFAULT 'none'
                                CHECK (discount_type IN ('none', 'percentage', 'fixed')),
  ADD COLUMN discount_value     numeric(12, 2),
  ADD COLUMN discount_enabled   boolean NOT NULL DEFAULT false,
  -- Optional, inclusive, evaluated in Sri Lanka time (Asia/Colombo).
  ADD COLUMN discount_starts_on date,
  ADD COLUMN discount_ends_on   date,
  ADD COLUMN availability       text NOT NULL DEFAULT 'on_request'
                                CHECK (availability IN ('available', 'out_of_stock', 'on_request'));

ALTER TABLE products
  ADD CONSTRAINT products_price_or_contact CHECK (contact_for_price OR price_lkr IS NOT NULL),
  ADD CONSTRAINT products_discount_needs_price CHECK (discount_type = 'none' OR price_lkr IS NOT NULL),
  ADD CONSTRAINT products_discount_value CHECK (
    (discount_type = 'none' AND discount_value IS NULL)
    OR (discount_type = 'percentage' AND discount_value > 0 AND discount_value <= 100)
    OR (discount_type = 'fixed' AND discount_value > 0 AND discount_value <= price_lkr)
  ),
  ADD CONSTRAINT products_discount_enabled CHECK (
    NOT discount_enabled OR (discount_type <> 'none' AND NOT contact_for_price)
  ),
  ADD CONSTRAINT products_discount_dates CHECK (
    discount_starts_on IS NULL OR discount_ends_on IS NULL OR discount_starts_on <= discount_ends_on
  );

-- Main image: exactly one per product once it has images. Existing images:
-- the first one (current display order) becomes the main image.
ALTER TABLE product_images ADD COLUMN is_main boolean NOT NULL DEFAULT false;
UPDATE product_images SET is_main = true
 WHERE id IN (SELECT DISTINCT ON (product_id) id FROM product_images ORDER BY product_id, sort_order, created_at);
CREATE UNIQUE INDEX product_images_one_main ON product_images (product_id) WHERE is_main;
