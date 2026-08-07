-- Richer intake for the guided onboarding wizard.
--
-- These columns exist to steer plan generation, not to diagnose anything.
-- body_shape/target_body_shape are the user's own self-selection from a set of
-- silhouettes — a subjective descriptor the model uses for framing, never a
-- body-composition measurement. Nothing here is derived from or substitutes
-- for a real body-fat reading.
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS body_shape TEXT
    CHECK (body_shape IN ('slim', 'average', 'athletic', 'heavier')),
  ADD COLUMN IF NOT EXISTS target_body_shape TEXT
    CHECK (target_body_shape IN ('slim', 'average', 'athletic', 'heavier')),
  ADD COLUMN IF NOT EXISTS workout_setting TEXT
    CHECK (workout_setting IN ('home', 'gym', 'outdoors', 'mixed')) DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS training_days_per_week INT
    CHECK (training_days_per_week BETWEEN 1 AND 7) DEFAULT 3,
  ADD COLUMN IF NOT EXISTS session_minutes INT
    CHECK (session_minutes BETWEEN 10 AND 180) DEFAULT 45,
  ADD COLUMN IF NOT EXISTS experience_level TEXT
    CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS limitations TEXT
    CHECK (limitations IS NULL OR char_length(limitations) <= 500);

COMMENT ON COLUMN public.coach_profiles.body_shape IS
  'User-selected silhouette describing their current build. Subjective self-report for AI framing — NOT a body-composition measurement.';
COMMENT ON COLUMN public.coach_profiles.target_body_shape IS
  'User-selected silhouette describing the build they are training toward.';
COMMENT ON COLUMN public.coach_profiles.workout_setting IS
  'Where the user trains — steers the AI away from exercises their setting cannot support.';
COMMENT ON COLUMN public.coach_profiles.limitations IS
  'Free-text injuries or movement limitations. Passed to the AI so it avoids contraindicated exercises; not medical advice.';

-- Optional self-reported body fat on a weigh-in. Almost always NULL: only
-- users with a smart scale or calipers can supply it. When present the
-- analytics layer prefers it over any estimate.
ALTER TABLE public.coach_weight_logs
  ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC(4,1)
    CHECK (body_fat_pct BETWEEN 3 AND 70);

COMMENT ON COLUMN public.coach_weight_logs.body_fat_pct IS
  'Optional user-supplied body fat %. Measured, not derived — analytics uses it in place of estimates when available.';

-- Health tips accompany a generated plan: short, general lifestyle guidance
-- (sleep, hydration, recovery) produced alongside the workouts and meals.
ALTER TABLE public.coach_plans
  ADD COLUMN IF NOT EXISTS health_tips TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.coach_plans.health_tips IS
  'General wellness tips generated with the plan. Not medical advice.';
