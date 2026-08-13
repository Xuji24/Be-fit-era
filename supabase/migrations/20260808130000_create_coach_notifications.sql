-- ============================================================
-- Migration: Proactive coaching — preferences + send dedup
--
-- Two tables for app/api/cron/coach-proactive/route.ts:
--   notification_preferences: per-user opt-out toggles.
--   coach_notification_log:   atomic "already sent" guard, same idea as
--                              coach_usage's UNIQUE(user_id, kind, period_key)
--                              dedup but for sends instead of quota.
-- ============================================================

-- No row is required to exist for a user — the cron treats a missing row
-- (or a NULL column) as "defaults enabled". This is an opt-out model, so no
-- backfill migration is needed for existing users.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_weekly_digest  BOOLEAN NOT NULL DEFAULT true,
  coach_streak_nudge   BOOLEAN NOT NULL DEFAULT true,
  coach_email_enabled  BOOLEAN NOT NULL DEFAULT true,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS
  'Per-user opt-out toggles for proactive coach notifications. A missing row means all defaults (enabled) apply — see app/api/cron/coach-proactive/route.ts.';

CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_coach_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_notification_preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Send dedup log
-- ============================================================
-- period_key encodes what "already sent" means per kind:
--   weekly_digest -> ISO week string, e.g. '2026-W33'
--   streak_nudge  -> 'streak-break:<last_logged_date>' — fires once per
--                    distinct last-logged date, so a still-quiet user isn't
--                    re-nudged every day, but a fresh break after recovering
--                    can nudge again.
--   goal_reached  -> the constant 'reached' — fires once ever per user.
-- The UNIQUE constraint is the entire dedup mechanism: the cron attempts an
-- INSERT before sending, and only sends if the insert actually happened.
CREATE TABLE IF NOT EXISTS public.coach_notification_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('weekly_digest', 'streak_nudge', 'goal_reached')),
  period_key TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, period_key)
);

COMMENT ON TABLE public.coach_notification_log IS
  'Dedup/audit trail for proactive coach sends. Written only by the service-role cron (app/api/cron/coach-proactive) — no user-facing reads needed, so RLS is enabled with no policies at all.';

CREATE INDEX IF NOT EXISTS idx_coach_notification_log_lookup
  ON public.coach_notification_log (user_id, kind, period_key);

-- RLS enabled, zero policies -> PostgREST exposes nothing to authenticated
-- or anon; only the service-role client (which bypasses RLS) can touch it.
ALTER TABLE public.coach_notification_log ENABLE ROW LEVEL SECURITY;
