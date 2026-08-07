-- Fix: users could read their own coach_subscriptions row but never create one,
-- so saveIntake's trial-start insert was silently blocked by RLS. Users must be
-- able to insert their own initial trial row; the CHECK pins every writable
-- field to what a brand-new trial looks like, so this cannot be used to
-- self-activate or extend a subscription — only to create the one-time starting state.
CREATE POLICY "users_start_own_coach_trial"
  ON public.coach_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'trialing'
    AND paymongo_session_id IS NULL
    AND current_period_end IS NULL
  );
