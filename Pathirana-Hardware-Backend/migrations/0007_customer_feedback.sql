-- Customer feedback submitted on the website, moderated by staff before anything
-- is shown publicly.
--
-- ADDITIVE ONLY: one new table; no existing table, column or row changes.
-- Nothing is inserted by this file (no example or sample reviews).
--
-- Privacy: only what the customer chose to have shown (display name, optional
-- general location) plus the rating and message. No phone number, email
-- address, IP address or account is collected or stored.
--
-- Publication: every submission starts 'pending'. Only 'approved' rows are
-- ever returned by the public API. 'rejected' and 'hidden' are never public.
--   pending  → approved | rejected
--   approved → hidden
--   hidden   → approved (restore, admin only)
--
-- Rollback (loses all feedback):
--   DROP TABLE customer_feedback;
--   DELETE FROM schema_migrations WHERE version = '0007_customer_feedback.sql';

CREATE TABLE customer_feedback (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One per form (sent by the browser): a retried / double-tapped submission
  -- returns the same record instead of creating a duplicate.
  idempotency_key    uuid NOT NULL,
  -- Hash of the normalised name + message: the same feedback sent again within
  -- a day is recognised as a duplicate.
  content_hash       text NOT NULL CHECK (length(content_hash) = 64),
  display_name       text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 60),
  rating             smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message            text NOT NULL CHECK (length(message) BETWEEN 10 AND 1000),
  location           text CHECK (length(location) BETWEEN 2 AND 80),
  -- Language the customer used on the website when writing (shown with the review).
  language           text NOT NULL CHECK (language IN ('en', 'ta', 'si')),
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  -- Consent record: the customer ticked the review-and-publish consent, and
  -- which wording they agreed to.
  publish_consent    boolean NOT NULL CHECK (publish_consent),
  consent_version    text NOT NULL CHECK (length(consent_version) BETWEEN 1 AND 40),
  -- Internal staff note (never public).
  moderation_note    text CHECK (length(moderation_note) BETWEEN 1 AND 500),
  moderated_at       timestamptz,
  moderated_by       uuid REFERENCES staff (id) ON DELETE SET NULL,
  -- First publication time (public ordering); kept when hidden and restored.
  approved_at        timestamptz,
  submitted_at       timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_feedback_moderated CHECK (status = 'pending' OR moderated_at IS NOT NULL),
  CONSTRAINT customer_feedback_approved_at CHECK (status <> 'approved' OR approved_at IS NOT NULL)
);
CREATE UNIQUE INDEX customer_feedback_idempotency_key ON customer_feedback (idempotency_key);
CREATE INDEX customer_feedback_status_idx ON customer_feedback (status, submitted_at DESC);
CREATE INDEX customer_feedback_public_idx ON customer_feedback (approved_at DESC) WHERE status = 'approved';
CREATE INDEX customer_feedback_dedupe_idx ON customer_feedback (content_hash, submitted_at DESC);
CREATE TRIGGER customer_feedback_updated_at BEFORE UPDATE ON customer_feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Defence in depth on Supabase (same as `npm run db:harden`): no policies, so the
-- Data API roles can read nothing; the API connects as the owner and is unaffected.
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
