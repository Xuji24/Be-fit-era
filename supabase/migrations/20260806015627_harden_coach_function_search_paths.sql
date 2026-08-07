-- Fix: advisor flagged both coach trigger functions for a mutable search_path,
-- which lets a caller's session-level search_path override unqualified
-- identifier resolution inside the function body. Pinning it closes that.
ALTER FUNCTION public.update_coach_updated_at() SET search_path = public;
ALTER FUNCTION public.coach_food_log_requires_plan_item() SET search_path = public;
