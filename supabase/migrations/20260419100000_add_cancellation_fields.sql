-- ============================================================
-- Migration: Add Cancellation Support
-- Adds 'cancelled' status to races and race_registrations,
-- plus cancellation tracking columns for soft-cancel workflow.
-- ============================================================

-- 1. Extend races.status CHECK to include 'cancelled'
ALTER TABLE public.races DROP CONSTRAINT IF EXISTS races_status_check;
ALTER TABLE public.races
  ADD CONSTRAINT races_status_check
  CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled'));

-- 2. Extend race_registrations.status CHECK to include 'cancelled'
ALTER TABLE public.race_registrations DROP CONSTRAINT IF EXISTS race_registrations_status_check;
ALTER TABLE public.race_registrations
  ADD CONSTRAINT race_registrations_status_check
  CHECK (status IN ('upcoming', 'in-progress', 'completed', 'cancelled'));

-- 3. Add cancellation columns to races
ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS cancelled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Add cancellation columns to race_registrations
ALTER TABLE public.race_registrations
  ADD COLUMN IF NOT EXISTS cancelled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
