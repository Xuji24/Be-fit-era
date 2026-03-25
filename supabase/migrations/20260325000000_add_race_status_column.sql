-- ============================================================
-- Migration: Add status column to races
-- ============================================================

ALTER TABLE public.races 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming' 
CHECK (status IN ('upcoming', 'active', 'completed'));
