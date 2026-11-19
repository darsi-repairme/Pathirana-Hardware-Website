-- Batch 5A (integration) — staff-managed brand logos and category images.
--
-- ADDITIVE ONLY: no table, column or row is dropped or rewritten. Every
-- existing brand and category starts with no uploaded file (NULL), so the
-- website keeps showing what it shows today (the original logo files bundled
-- with the site, the illustrative category artwork, or the name / an icon).
--
-- Files live under UPLOAD_DIR (outside any web root) with server-generated
-- names; only the key and the decoded dimensions are stored here.

ALTER TABLE brands
  ADD COLUMN logo_key    uuid,
  ADD COLUMN logo_width  integer CHECK (logo_width BETWEEN 1 AND 12000),
  ADD COLUMN logo_height integer CHECK (logo_height BETWEEN 1 AND 12000),
  ADD CONSTRAINT brands_logo_complete CHECK (
    (logo_key IS NULL AND logo_width IS NULL AND logo_height IS NULL)
    OR (logo_key IS NOT NULL AND logo_width IS NOT NULL AND logo_height IS NOT NULL)
  );
CREATE UNIQUE INDEX brands_logo_key ON brands (logo_key) WHERE logo_key IS NOT NULL;

ALTER TABLE categories
  ADD COLUMN image_key    uuid,
  ADD COLUMN image_width  integer CHECK (image_width BETWEEN 1 AND 12000),
  ADD COLUMN image_height integer CHECK (image_height BETWEEN 1 AND 12000),
  ADD COLUMN image_alt    text CHECK (length(image_alt) BETWEEN 1 AND 250),
  ADD CONSTRAINT categories_image_complete CHECK (
    (image_key IS NULL AND image_width IS NULL AND image_height IS NULL AND image_alt IS NULL)
    OR (image_key IS NOT NULL AND image_width IS NOT NULL AND image_height IS NOT NULL AND image_alt IS NOT NULL)
  );
CREATE UNIQUE INDEX categories_image_key ON categories (image_key) WHERE image_key IS NOT NULL;
