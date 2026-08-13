-- Supabase performance advisor (auth_rls_initplan): these 11 policies call
-- auth.uid() directly in USING/WITH CHECK, which Postgres re-evaluates once
-- per row scanned. Wrapping it as (select auth.uid()) lets the planner treat
-- it as a stable subquery evaluated once per statement instead — same
-- semantics, cheaper at scale. https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
alter policy "users_manage_own_coach_profile" on public.coach_profiles
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users_read_own_coach_subscription" on public.coach_subscriptions
  using ((select auth.uid()) = user_id);

alter policy "users_start_own_coach_trial" on public.coach_subscriptions
  with check (
    (select auth.uid()) = user_id
    and status = 'trialing'
    and tier = 'free'
    and paymongo_session_id is null
    and current_period_end is null
  );

alter policy "users_manage_own_coach_plans" on public.coach_plans
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users_manage_own_coach_plan_items" on public.coach_plan_items
  using (exists (
    select 1 from public.coach_plans p
    where p.id = coach_plan_items.plan_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.coach_plans p
    where p.id = coach_plan_items.plan_id and p.user_id = (select auth.uid())
  ));

alter policy "users_manage_own_coach_food_logs" on public.coach_food_logs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users_manage_own_coach_workout_logs" on public.coach_workout_logs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users_manage_own_coach_messages" on public.coach_messages
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users_manage_own_coach_weight_logs" on public.coach_weight_logs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "users_read_own_coach_usage" on public.coach_usage
  using ((select auth.uid()) = user_id);

alter policy "users_manage_own_notification_preferences" on public.notification_preferences
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
