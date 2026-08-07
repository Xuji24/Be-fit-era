-- ============================================================
-- Migration: AI Coach — subscription tiers & metered usage
--
-- Replaces the binary trial/no-trial gate with three tiers (free/starter/pro)
-- and per-feature quotas. Plan generations and chat messages are metered
-- separately because a plan costs roughly 20x a chat turn to produce.
-- Limits themselves live in lib/coach/tiers.ts — this schema only records
-- which tier a user is on and how much they have spent.
-- ============================================================

ALTER TABLE public.coach_subscriptions
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'starter', 'pro'));

COMMENT ON COLUMN public.coach_subscriptions.tier IS
  'free = trial allowance, starter/paid = monthly. Set only by the PayMongo webhook (service role); users can insert their own row as free but never write this afterwards.';

-- Existing trialists keep their 14-day window and land on the free allowance.
UPDATE public.coach_subscriptions SET tier = 'free' WHERE tier IS NULL;

-- ============================================================
-- Usage meter
-- ============================================================
-- One row per (user, kind, period). period_key is a string bucket computed by
-- periodKey() in lib/coach/tiers.ts: 'trial' for the one-time free allowance,
-- 'YYYY-MM' for monthly, 'YYYY-MM-DD' for daily. Keeping the bucket as a
-- string means a tier can change its reset cadence without a schema change.
CREATE TABLE IF NOT EXISTS public.coach_usage (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('plan', 'chat')),
  period_key TEXT NOT NULL,
  count      INT  NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, period_key)
);

COMMENT ON TABLE public.coach_usage IS
  'Metered AI usage. Incremented only by consume_coach_quota(); never written directly by clients.';

CREATE INDEX IF NOT EXISTS idx_coach_usage_lookup
  ON public.coach_usage (user_id, kind, period_key);

CREATE TRIGGER trg_coach_usage_updated_at
BEFORE UPDATE ON public.coach_usage
FOR EACH ROW EXECUTE FUNCTION public.update_coach_updated_at();

-- ============================================================
-- Atomic consume
-- ============================================================
-- Claims one unit of quota and returns whether it was granted. The INSERT
-- .. ON CONFLICT DO UPDATE .. WHERE is what makes this safe: two concurrent
-- requests at count = limit - 1 cannot both succeed, because the second one's
-- WHERE fails against the already-incremented row. A read-then-write in
-- application code would let both through.
--
-- SECURITY DEFINER so it can write a table the caller has no INSERT rights on,
-- with search_path pinned per the earlier hardening migration.
CREATE OR REPLACE FUNCTION public.consume_coach_quota(
  p_kind       TEXT,
  p_period_key TEXT,
  p_limit      INT
)
RETURNS TABLE (granted BOOLEAN, used INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_used    INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  IF p_limit <= 0 THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  INSERT INTO public.coach_usage (user_id, kind, period_key, count)
  VALUES (v_user_id, p_kind, p_period_key, 1)
  ON CONFLICT (user_id, kind, period_key) DO UPDATE
    SET count = public.coach_usage.count + 1
    WHERE public.coach_usage.count < p_limit
  RETURNING public.coach_usage.count INTO v_used;

  -- No row returned => the ON CONFLICT WHERE rejected it => quota exhausted.
  IF v_used IS NULL THEN
    SELECT u.count INTO v_used
    FROM public.coach_usage u
    WHERE u.user_id = v_user_id AND u.kind = p_kind AND u.period_key = p_period_key;
    RETURN QUERY SELECT FALSE, COALESCE(v_used, 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_used;
END;
$$;

-- REVOKE FROM PUBLIC does not cover anon: it holds its own grant in the
-- exposed API schema, so without the explicit revoke the function stays
-- callable unauthenticated via /rest/v1/rpc/. (Harmless — auth.uid() is NULL
-- so it returns granted=false — but it should not be reachable at all.)
REVOKE ALL ON FUNCTION public.consume_coach_quota(TEXT, TEXT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_coach_quota(TEXT, TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_coach_quota(TEXT, TEXT, INT) TO authenticated;

-- ============================================================
-- RLS — usage is readable by its owner, writable by no one
-- ============================================================
ALTER TABLE public.coach_usage ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner so the UI can render "3 of 20 messages left".
-- There is deliberately no INSERT/UPDATE policy: all writes go through
-- consume_coach_quota(), which is SECURITY DEFINER and bypasses RLS.
CREATE POLICY "users_read_own_coach_usage"
  ON public.coach_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Close the self-upgrade hole
-- ============================================================
-- The existing insert policy pins status='trialing' but predates the tier
-- column, so as written it would let a user insert their own row with
-- tier='pro'. Recreate it with tier pinned to 'free'.
DROP POLICY IF EXISTS "users_start_own_coach_trial" ON public.coach_subscriptions;

CREATE POLICY "users_start_own_coach_trial"
  ON public.coach_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'trialing'
    AND tier = 'free'
    AND paymongo_session_id IS NULL
    AND current_period_end IS NULL
  );
