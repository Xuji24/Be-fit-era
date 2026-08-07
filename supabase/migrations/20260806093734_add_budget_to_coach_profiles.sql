-- Meal-plan budget: a tier the AI treats as a hard steer (cheap staples vs
-- premium ingredients), plus an optional numeric estimate that is advisory
-- only — the AI cannot verify real prices, so this is a soft guideline the
-- model follows loosely, not a constraint enforced anywhere else in the schema.
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS budget_tier TEXT
    CHECK (budget_tier IN ('low', 'medium', 'high')) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS daily_budget_php NUMERIC(8,2)
    CHECK (daily_budget_php > 0);

COMMENT ON COLUMN public.coach_profiles.budget_tier IS
  'low/medium/high steer for meal cost in AI-generated plans.';
COMMENT ON COLUMN public.coach_profiles.daily_budget_php IS
  'Optional user-entered daily food budget in PHP — advisory only, not price-verified.';
