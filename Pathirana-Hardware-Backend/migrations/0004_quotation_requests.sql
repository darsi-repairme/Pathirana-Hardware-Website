-- Batch 5B — customer quotation requests (no orders, no payments).
--
-- ADDITIVE ONLY: three new tables; no existing table, column or row changes.
-- Customer contact details are personal data: they are readable only through
-- the staff API (never public). Reference photos are stored privately under
-- UPLOAD_DIR/quotations and served only to signed-in staff.
--
-- Deleting a product never erases quotation history: each item keeps the
-- product name as submitted, and its link to the product becomes NULL.

CREATE TABLE quotation_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          text NOT NULL CHECK (reference ~ '^PHQ-[0-9]{6}-[A-Z2-9]{5}$'),
  -- One per form submission (sent by the browser): a retried / double-clicked
  -- submission returns the same request instead of creating a duplicate.
  idempotency_key    uuid NOT NULL,
  -- Hash of the normalised content: an identical resubmission from the same
  -- phone number within a short window returns the existing request.
  content_hash       text NOT NULL CHECK (length(content_hash) = 64),
  customer_name      text NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 120),
  phone              text NOT NULL CHECK (phone ~ '^\+?[0-9]{9,15}$'),
  email              text CHECK (length(email) BETWEEN 3 AND 254),
  location           text NOT NULL CHECK (length(location) BETWEEN 1 AND 120),
  -- true: one of the listed service areas; false: "Other" (typed by the customer).
  location_listed    boolean NOT NULL,
  fulfilment         text NOT NULL CHECK (fulfilment IN ('delivery', 'collection')),
  delivery_address   text CHECK (length(delivery_address) BETWEEN 1 AND 500),
  notes              text CHECK (length(notes) BETWEEN 1 AND 2000),
  contact_consent    boolean NOT NULL CHECK (contact_consent),
  status             text NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'in_review', 'quoted', 'closed', 'cancelled')),
  status_changed_at  timestamptz,
  status_changed_by  uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotation_address_for_delivery CHECK (fulfilment = 'collection' OR delivery_address IS NOT NULL)
);
CREATE UNIQUE INDEX quotation_requests_reference_key ON quotation_requests (reference);
CREATE UNIQUE INDEX quotation_requests_idempotency_key ON quotation_requests (idempotency_key);
CREATE INDEX quotation_requests_status_idx ON quotation_requests (status, created_at DESC);
CREATE INDEX quotation_requests_created_idx ON quotation_requests (created_at DESC);
CREATE INDEX quotation_requests_dedupe_idx ON quotation_requests (phone, content_hash, created_at DESC);
CREATE TRIGGER quotation_requests_updated_at BEFORE UPDATE ON quotation_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE quotation_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  uuid NOT NULL REFERENCES quotation_requests (id) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position BETWEEN 1 AND 30),
  product_id    uuid REFERENCES products (id) ON DELETE SET NULL,
  product_name  text NOT NULL CHECK (length(product_name) BETWEEN 1 AND 160),
  quantity      numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit          text CHECK (length(unit) BETWEEN 1 AND 40),
  CONSTRAINT quotation_items_position_key UNIQUE (quotation_id, position)
);
CREATE INDEX quotation_items_product_idx ON quotation_items (product_id) WHERE product_id IS NOT NULL;

CREATE TABLE quotation_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  uuid NOT NULL REFERENCES quotation_requests (id) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position BETWEEN 1 AND 10),
  storage_key   uuid NOT NULL,
  width         integer NOT NULL CHECK (width > 0),
  height        integer NOT NULL CHECK (height > 0),
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotation_photos_position_key UNIQUE (quotation_id, position)
);
CREATE UNIQUE INDEX quotation_photos_storage_key ON quotation_photos (storage_key);
