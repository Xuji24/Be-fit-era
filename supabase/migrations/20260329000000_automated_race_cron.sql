-- ============================================================
-- Migration: Automate Race Timeframes using pg_cron
-- ============================================================

-- Ensure that the pg_cron extension is enabled in the database
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 1. Job to auto-start 'upcoming' races on their event_date
-- Runs daily at 00:00 (Midnight UTC)
SELECT cron.schedule(
  'auto-activate-races',
  '0 0 * * *',
  $$
    UPDATE public.races
    SET status = 'active'
    WHERE status = 'upcoming'
      AND event_date = CURRENT_DATE;
  $$
);

-- 2. Job to auto-complete 'active' races when their event_date has passed
-- Runs daily at 00:05 (Just after the activate job, to avoid race conditions and ensure cleanup)
SELECT cron.schedule(
  'auto-complete-races',
  '5 0 * * *',
  $$
    UPDATE public.races
    SET status = 'completed'
    WHERE status != 'completed'
      AND event_date < CURRENT_DATE;
  $$
);
