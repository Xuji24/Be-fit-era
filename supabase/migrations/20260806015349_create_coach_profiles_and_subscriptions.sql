-- ============================================================
-- Migration: AI Coach — user intake profile & subscription gating
-- ============================================================

-- Intake profile: seeds every plan the AI generates. One row per user.
CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm            NUMERIC(5,2) NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  weight_kg            NUMERIC(5,2) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  birth_date           DATE NOT NULL,
  sex                  TEXT NOT NULL CHECK (sex IN ('male', 'female')),
  activity_level       TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal                 TEXT NOT NULL CHECK (goal IN ('lose_fat', 'build_muscle', 'maintain', 'endurance')),
  target_weight_kg     NUMERIC(5,2) CHECK (target_weight_kg BETWEEN 30 AND 300),
  dietary_restrictions TEXT[] NOT NULL DEFAULT '{}',
  equipment_access     TEXT[] NOT NULL DEFAULT '{}',

  -- Derived, never hand-written: BMI = kg / m^2
  bmi NUMERIC(5,2) GENERATED ALWAYS AS
    (weight_kg / ((height_cm / 100) * (height_cm / 100))) STORED,

  -- AI-set targets, stored so the tracker never re-queries the LLM to render a page.
  -- Floors are enforced here as a hard backstop against a bad model response;
  -- lib/coach/nutrition.ts clamps before insert, this is the last line of defence.
  tdee_kcal        INT CHECK (tdee_kcal BETWEEN 1000 AND 6000),
  daily_kcal_target INT CHECK (daily_kcal_target BETWEEN 1200 AND 6000),
  protein_g_target INT CHECK (protein_g_target BETWEEN 0 AND 500),
  carbs_g_target   INT CHECK (carbs_g_target BETWEEN 0 AND 1000),
  fat_g_target     INT CHECK (fat_g_target BETWEEN 0 AND 400),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.coach_profiles.bmi IS
  'Generated from height/weight — never written directly.';
COMMENT ON COLUMN public.coach_profiles.daily_kcal_target IS
  'Hard floor of 1200 kcal guards against an AI-suggested unsafe deficit.';

-- Subscription: 14-day trial then PayMongo. Gating is enforced in server actions;
-- this table is the source of truth they read.
CREATE TABLE IF NOT EXISTS public.coach_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'expired', 'cancelled')),
  trial_started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  paymongo_session_id TEXT,
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.coach_subscriptions.status IS
  'trialing = within 14-day window, active = paid via PayMongo webhook, expired/cancelled = no access';

-- Index for the cron sweep that expires lapsed trials.
CREATE INDEX IF NOT EXISTS idx_coach_subscriptions_status_trial
  ON public.coach_subscriptions (status, trial_ends_at);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_coach_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_coach_profiles_updated_at
BEFORE UPDATE ON public.coach_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_coach_updated_at();

CREATE TRIGGER trg_coach_subscriptions_updated_at
BEFORE UPDATE ON public.coach_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_coach_updated_at();

-- ============================================================
-- RLS Policies — coach data is strictly private to its owner
-- ============================================================
ALTER TABLE public.coach_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_coach_profile"
  ON public.coach_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users may read their own subscription but never write it — status changes
-- come from the PayMongo webhook and cron, both of which use the service role.
CREATE POLICY "users_read_own_coach_subscription"
  ON public.coach_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
