-- Task 04 — staff email notifications for new quotation requests (Option 2:
-- an admin chooses which staff receive them).
--
-- ADDITIVE ONLY: two new tables; no existing table, column or row changes.
--
-- 1. quotation_notification_recipients — the staff an admin selected. A staff
--    account that is later deactivated stays listed here but is skipped when
--    notifications are created; a deleted account disappears (CASCADE).
-- 2. quotation_notifications — a durable outbox: one row per (quotation,
--    recipient), written in the same transaction as the quotation request, then
--    delivered by the API's dispatcher with retries. Customer details are NOT
--    copied here: the email is built from the quotation at sending time.
--
-- Rollback (only if no notifications need keeping):
--   DROP TABLE quotation_notifications; DROP TABLE quotation_notification_recipients;
--   DELETE FROM schema_migrations WHERE version = '0005_quotation_notifications.sql';

CREATE TABLE quotation_notification_recipients (
  staff_id   uuid PRIMARY KEY REFERENCES staff (id) ON DELETE CASCADE,
  added_by   uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quotation_notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id        uuid NOT NULL REFERENCES quotation_requests (id) ON DELETE CASCADE,
  -- Kept for history if the staff account is removed later.
  staff_id            uuid REFERENCES staff (id) ON DELETE SET NULL,
  email               text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  -- pending: waiting / retrying; sent: accepted by the email provider;
  -- failed: gave up after the maximum attempts; cancelled: recipient no longer eligible.
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts            integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at     timestamptz NOT NULL DEFAULT now(),
  -- A dispatcher holds a short lease while sending, so two workers never send the same email.
  locked_until        timestamptz,
  last_error          text CHECK (length(last_error) <= 500),
  provider_message_id text CHECK (length(provider_message_id) <= 200),
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'sent' OR sent_at IS NOT NULL)
);
-- Never two notifications of the same quotation to the same address.
CREATE UNIQUE INDEX quotation_notifications_once ON quotation_notifications (quotation_id, email);
CREATE INDEX quotation_notifications_due_idx ON quotation_notifications (next_attempt_at) WHERE status = 'pending';
CREATE INDEX quotation_notifications_quotation_idx ON quotation_notifications (quotation_id);
CREATE TRIGGER quotation_notifications_updated_at BEFORE UPDATE ON quotation_notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
