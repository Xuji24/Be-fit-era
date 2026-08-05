-- ============================================================
-- Migration: Add Race Location Coordinates
-- Adds nullable lat/lng so the organizer's pinned location can
-- be shown on a map. Races without coordinates are unaffected.
-- ============================================================

ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
