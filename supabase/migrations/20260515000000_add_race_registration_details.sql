-- ============================================================
-- Migration: Add registration detail fields to races table
-- ============================================================

ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS registration_fee    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cutoff_time_minutes INT,
  ADD COLUMN IF NOT EXISTS kit_pickup_info     TEXT,
  ADD COLUMN IF NOT EXISTS inclusions          TEXT[];
