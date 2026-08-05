-- ============================================================
-- Migration: Add payment tracking columns to race_registrations
-- ============================================================

ALTER TABLE public.race_registrations
  ADD COLUMN IF NOT EXISTS payment_status      TEXT    NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  ADD COLUMN IF NOT EXISTS paymongo_session_id TEXT;

COMMENT ON COLUMN public.race_registrations.payment_status IS
  'pending = awaiting payment, paid = confirmed by PayMongo webhook, refunded/failed = terminal states';

COMMENT ON COLUMN public.race_registrations.paymongo_session_id IS
  'PayMongo checkout session id — set by webhook on successful payment';

-- Index for webhook lookups (race_id + user_id is the natural key used there)
CREATE INDEX IF NOT EXISTS idx_race_registrations_payment_status
  ON public.race_registrations (payment_status);
