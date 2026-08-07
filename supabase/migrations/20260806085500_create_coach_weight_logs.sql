-- Standalone weigh-in history, separate from coach_profiles (which holds only
-- the current weight, overwritten on every onboarding update). BMI is computed
-- and stored at log time, not derived from height_cm on coach_profiles — a
-- later height correction must not retroactively rewrite past BMI history.
CREATE TABLE IF NOT EXISTS public.coach_weight_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg  NUMERIC(5,2) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  height_cm  NUMERIC(5,2) NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  bmi        NUMERIC(5,2) GENERATED ALWAYS AS
    (weight_kg / ((height_cm / 100) * (height_cm / 100))) STORED,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One weigh-in per user per day; logging again the same day replaces intent,
  -- not accumulates noise. UI can upsert against this rather than fight it.
  UNIQUE (user_id, logged_on)
);

COMMENT ON TABLE public.coach_weight_logs IS
  'Append-only weigh-in history. height_cm is copied at log time so a later profile correction cannot rewrite past BMI values.';

-- Drives the trend chart: "give me this user's history, oldest first".
CREATE INDEX IF NOT EXISTS idx_coach_weight_logs_user_date
  ON public.coach_weight_logs (user_id, logged_on);

ALTER TABLE public.coach_weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_coach_weight_logs"
  ON public.coach_weight_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
