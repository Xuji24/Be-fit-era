-- ============================================================
-- Migration: Align race_registrations.payment_method with what
-- PayMongo's checkout actually offers
-- ============================================================
--
-- payment_method was constrained to ('gcash', 'card', 'bank'), but the
-- PayMongo checkout session created in lib/paymongo.ts only ever offers
-- payment_method_types: ['gcash', 'paymaya', 'qrph'] — 'card' and 'bank' are
-- never actually presented once the user reaches PayMongo's hosted page.
-- Remap any existing rows first so the constraint change doesn't fail
-- against existing data.

UPDATE public.race_registrations SET payment_method = 'paymaya' WHERE payment_method = 'card';
UPDATE public.race_registrations SET payment_method = 'qrph' WHERE payment_method = 'bank';

ALTER TABLE public.race_registrations
  DROP CONSTRAINT IF EXISTS race_registrations_payment_method_check;

ALTER TABLE public.race_registrations
  ADD CONSTRAINT race_registrations_payment_method_check
  CHECK (payment_method IN ('gcash', 'paymaya', 'qrph'));
