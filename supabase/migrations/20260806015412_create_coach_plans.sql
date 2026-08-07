-- ============================================================
-- Migration: AI Coach — generated plans & their workout/meal items
-- ============================================================

-- A plan is immutable once logged against. Chat edits archive the current
-- version and write a new one, so historical logs never point at mutated rows.
CREATE TABLE IF NOT EXISTS public.coach_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version      INT  NOT NULL DEFAULT 1 CHECK (version > 0),
  starts_on    DATE NOT NULL,
  weeks        INT  NOT NULL DEFAULT 4 CHECK (weeks BETWEEN 1 AND 52),
  summary      TEXT,
  generated_by TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

COMMENT ON COLUMN public.coach_plans.generated_by IS
  'Provider + model that produced this plan, e.g. "groq:llama-3.3-70b" — needed to trace bad output.';

-- Only one active plan per user. Archived versions are unlimited.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_plans_one_active
  ON public.coach_plans (user_id) WHERE status = 'active';

-- Workouts and meals share a table: they carry the same columns and are always
-- queried together by day. `details` holds the genuinely variable shape
-- (sets/reps vs ingredients/grams); macros stay relational so SQL can sum them.
CREATE TABLE IF NOT EXISTS public.coach_plan_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id   UUID NOT NULL REFERENCES public.coach_plans(id) ON DELETE CASCADE,
  day_index INT  NOT NULL CHECK (day_index >= 0),
  item_type TEXT NOT NULL CHECK (item_type IN ('workout', 'meal')),
  slot      TEXT NOT NULL,
  title     TEXT NOT NULL,
  details   JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Meals only; a workout row leaves these NULL.
  kcal      INT          CHECK (kcal      >= 0),
  protein_g NUMERIC(6,2) CHECK (protein_g >= 0),
  carbs_g   NUMERIC(6,2) CHECK (carbs_g   >= 0),
  fat_g     NUMERIC(6,2) CHECK (fat_g     >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Slot vocabulary depends on the item type; a meal can't be scheduled 'pm'.
  CONSTRAINT coach_plan_items_slot_matches_type CHECK (
    (item_type = 'meal'    AND slot IN ('breakfast', 'lunch', 'dinner', 'snack')) OR
    (item_type = 'workout' AND slot IN ('am', 'pm'))
  ),
  -- Meals must carry macros; workouts must not.
  CONSTRAINT coach_plan_items_macros_match_type CHECK (
    (item_type = 'meal'    AND kcal IS NOT NULL) OR
    (item_type = 'workout' AND kcal IS NULL AND protein_g IS NULL
                            AND carbs_g IS NULL AND fat_g IS NULL)
  )
);

-- Primary access pattern: "give me plan X, day N, in order".
CREATE INDEX IF NOT EXISTS idx_coach_plan_items_plan_day
  ON public.coach_plan_items (plan_id, day_index, item_type);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.coach_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_coach_plans"
  ON public.coach_plans FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Plan items carry no user_id — ownership is derived from the parent plan.
-- The index on coach_plans(id) is the PK, so this subquery stays cheap.
CREATE POLICY "users_manage_own_coach_plan_items"
  ON public.coach_plan_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_plans p
    WHERE p.id = coach_plan_items.plan_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coach_plans p
    WHERE p.id = coach_plan_items.plan_id AND p.user_id = auth.uid()
  ));
