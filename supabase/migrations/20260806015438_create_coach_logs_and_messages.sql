-- ============================================================
-- Migration: AI Coach — food/workout logs & chat history
-- ============================================================

-- Food logs. Two entry paths feed one daily total:
--   source = 'plan'   → user marks a planned meal eaten; macros auto-filled
--   source = 'manual' → off-plan food, user enters name + grams
--
-- Macros are COPIED here, never joined from coach_plan_items. Regenerating a
-- plan must not retroactively change what a user already ate.
CREATE TABLE IF NOT EXISTS public.coach_food_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  slot         TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  source       TEXT NOT NULL CHECK (source IN ('plan', 'manual')),
  plan_item_id UUID REFERENCES public.coach_plan_items(id) ON DELETE SET NULL,

  food_name TEXT NOT NULL,
  grams     NUMERIC(7,2) CHECK (grams > 0),
  kcal      INT          NOT NULL CHECK (kcal      >= 0),
  protein_g NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g   NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (carbs_g   >= 0),
  fat_g     NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (fat_g     >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A 'manual' log must never reference a plan item. A 'plan' log normally
  -- does, but is allowed to go NULL: ON DELETE SET NULL orphans the log when
  -- its plan item is deleted, and the log must survive that (see table comment).
  CONSTRAINT coach_food_logs_manual_has_no_item CHECK (
    source = 'plan' OR plan_item_id IS NULL
  )
);

COMMENT ON TABLE public.coach_food_logs IS
  'Macros denormalized on purpose: a log is a historical record, immune to plan regeneration.';

-- A new 'plan' log must reference its item. This is a trigger rather than a
-- CHECK because it must apply on INSERT only: ON DELETE SET NULL later nulls
-- plan_item_id on purpose, and a CHECK would delete the row instead of orphaning it.
CREATE OR REPLACE FUNCTION public.coach_food_log_requires_plan_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source = 'plan' AND NEW.plan_item_id IS NULL THEN
    RAISE EXCEPTION 'a plan-sourced food log must reference a plan item';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_coach_food_log_requires_plan_item
BEFORE INSERT ON public.coach_food_logs
FOR EACH ROW EXECUTE FUNCTION public.coach_food_log_requires_plan_item();

-- The duplicate-entry guard: a planned meal can be logged exactly once.
-- Enforced by the DB so a double-tap or a retried request cannot double-count.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_food_logs_one_per_plan_item
  ON public.coach_food_logs (plan_item_id) WHERE plan_item_id IS NOT NULL;

-- Drives both the daily tracker and the progress charts.
CREATE INDEX IF NOT EXISTS idx_coach_food_logs_user_date
  ON public.coach_food_logs (user_id, logged_on DESC);

-- Workout completion. Mirrors the food-log shape, same once-per-item rule.
CREATE TABLE IF NOT EXISTS public.coach_workout_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_item_id UUID REFERENCES public.coach_plan_items(id) ON DELETE SET NULL,
  completed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_min INT CHECK (duration_min > 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_workout_logs_one_per_plan_item
  ON public.coach_workout_logs (plan_item_id) WHERE plan_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_workout_logs_user_date
  ON public.coach_workout_logs (user_id, completed_on DESC);

-- Chat history. The first conversation IS the intake analysis; later turns
-- modify the plan. plan_version records which plan a turn produced, if any.
CREATE TABLE IF NOT EXISTS public.coach_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content      TEXT NOT NULL CHECK (char_length(content) <= 8000),
  plan_version INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_messages_user_created
  ON public.coach_messages (user_id, created_at);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.coach_food_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_messages     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_coach_food_logs"
  ON public.coach_food_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_manage_own_coach_workout_logs"
  ON public.coach_workout_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_manage_own_coach_messages"
  ON public.coach_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
