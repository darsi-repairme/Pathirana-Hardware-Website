-- Multilingual website — Tamil (ta) and Sinhala (si) versions of customer-facing
-- catalogue text, entered by staff in the Admin dashboard.
--
-- ADDITIVE ONLY: one new column per table, defaulting to an empty object. No
-- existing column or row changes; the existing English columns stay the
-- default-language source of truth. The website falls back to the English value
-- for every field that has no translation, so nothing changes for customers
-- until staff enter translations. No translations are inserted by this file.
--
-- Shape (validated by the API; the database enforces the outer keys):
--   products.translations       {"ta": {"name","summary","description","searchTerms":[…]}, "si": {…}}
--   categories.translations     {"ta": {"name","description"}, "si": {…}}
--   delivery_areas.translations {"ta": {"name","notes"}, "si": {…}}
--
-- Rollback (loses only entered translations):
--   ALTER TABLE products DROP COLUMN translations;
--   ALTER TABLE categories DROP COLUMN translations;
--   ALTER TABLE delivery_areas DROP COLUMN translations;
--   DELETE FROM schema_migrations WHERE version = '0006_content_translations.sql';

ALTER TABLE products
  ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT products_translations_shape CHECK (
    jsonb_typeof(translations) = 'object'
    AND (translations - ARRAY['ta', 'si']) = '{}'::jsonb
    AND length(translations::text) <= 24000
  );

ALTER TABLE categories
  ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT categories_translations_shape CHECK (
    jsonb_typeof(translations) = 'object'
    AND (translations - ARRAY['ta', 'si']) = '{}'::jsonb
    AND length(translations::text) <= 10000
  );

ALTER TABLE delivery_areas
  ADD COLUMN translations jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT delivery_areas_translations_shape CHECK (
    jsonb_typeof(translations) = 'object'
    AND (translations - ARRAY['ta', 'si']) = '{}'::jsonb
    AND length(translations::text) <= 4000
  );
