-- ============================================================
-- Migration: Add Anti-Cheat / Dispute Fields
-- ============================================================

-- Add flagging fields to activity_entries
ALTER TABLE public.activity_entries
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS flag_reason TEXT,
ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create an admin view or dispute tracking view later if needed,
-- but adding flags directly to the activities allows instant filtering.
