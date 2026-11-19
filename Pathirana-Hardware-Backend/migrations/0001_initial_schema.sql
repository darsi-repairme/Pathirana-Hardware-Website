-- Pathirana Hardware website API — initial schema.
-- Target: the SEPARATE website database. Never apply to the POS database.
-- Inserts no business data (categories, brands and product types are loaded
-- only by the explicit `npm run seed:catalogue` command).

-- updated_at maintenance ----------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Staff, roles ----------------------------------------------------------------
-- Roles: admin (everything, incl. staff accounts) · editor (catalogue and
-- delivery areas). Permissions per role are defined in code (src/auth/roles.ts).
CREATE TYPE staff_role AS ENUM ('admin', 'editor');

CREATE TABLE staff (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  full_name         text NOT NULL CHECK (length(full_name) BETWEEN 1 AND 120),
  password_hash     text NOT NULL,
  role              staff_role NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  -- Incremented on logout / deactivation: every token carrying an older value is rejected.
  token_version     integer NOT NULL DEFAULT 0 CHECK (token_version >= 0),
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until      timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_email_key ON staff (email);
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Catalogue -------------------------------------------------------------------
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description text CHECK (length(description) <= 2000),
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_slug_key ON categories (slug);
CREATE UNIQUE INDEX categories_name_key ON categories (lower(name));
CREATE INDEX categories_active_idx ON categories (sort_order, name) WHERE is_active;
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX brands_slug_key ON brands (slug);
CREATE UNIQUE INDEX brands_name_key ON brands (lower(name));
CREATE TRIGGER brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Products are product TYPES or verified items — no price, stock, SKU or
-- dimension columns exist on purpose (none have been confirmed).
CREATE TABLE products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  category_id  uuid NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  summary      text CHECK (length(summary) <= 300),
  description  text CHECK (length(description) <= 5000),
  search_terms text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_published OR published_at IS NOT NULL)
);
CREATE UNIQUE INDEX products_slug_key ON products (slug);
CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_published_idx ON products (name) WHERE is_published;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Product ↔ brand links: set only by staff once confirmed (never inferred).
CREATE TABLE product_brands (
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  brand_id   uuid NOT NULL REFERENCES brands (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, brand_id)
);
CREATE INDEX product_brands_brand_idx ON product_brands (brand_id);

CREATE TABLE product_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  -- Server-generated file base name (never the uploaded file name).
  storage_key text NOT NULL CHECK (storage_key ~ '^[0-9a-f-]{36}$'),
  mime_type   text NOT NULL CHECK (mime_type = 'image/webp'),
  width       integer NOT NULL CHECK (width > 0),
  height      integer NOT NULL CHECK (height > 0),
  size_bytes  integer NOT NULL CHECK (size_bytes > 0),
  alt_text    text NOT NULL CHECK (length(alt_text) BETWEEN 1 AND 250),
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_images_storage_key ON product_images (storage_key);
CREATE INDEX product_images_product_idx ON product_images (product_id, sort_order);

-- Delivery areas --------------------------------------------------------------
-- None have been confirmed yet: this table starts empty.
CREATE TABLE delivery_areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  district    text CHECK (length(district) <= 80),
  postal_code text CHECK (postal_code ~ '^[0-9]{5}$'),
  is_active   boolean NOT NULL DEFAULT true,
  notes       text CHECK (length(notes) <= 500),
  -- Only an owner-approved fee (LKR); NULL = not published.
  fee_lkr     numeric(10, 2) CHECK (fee_lkr >= 0),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (archived_at IS NULL OR NOT is_active)
);
CREATE UNIQUE INDEX delivery_areas_name_key
  ON delivery_areas (lower(name), lower(coalesce(district, ''))) WHERE archived_at IS NULL;
CREATE INDEX delivery_areas_active_idx ON delivery_areas (lower(name)) WHERE is_active AND archived_at IS NULL;
CREATE TRIGGER delivery_areas_updated_at BEFORE UPDATE ON delivery_areas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Audit log (admin changes) ---------------------------------------------------
CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id    uuid REFERENCES staff (id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  details     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_log_staff_idx ON audit_log (staff_id, created_at DESC);
