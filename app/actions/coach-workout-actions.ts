"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./coach-actions";

/**
 * Marks a planned workout complete. Upserts on plan_item_id (unique index) so
 * double-tapping the button is idempotent rather than an error, and re-logging
 * updates the date instead of creating a duplicate.
 */
export async function logWorkoutComplete(input: {
  planItemId: string;
  date: string;
  durationMin?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  if (input.durationMin !== undefined && !(input.durationMin > 0 && input.durationMin <= 600)) {
    return { success: false, error: "Duration must be between 1 and 600 minutes." };
  }

  // Confirm the plan item is a workout that belongs to this user. Without this
  // a crafted ID could attach a log to someone else's plan item.
  const { data: item } = await supabase
    .from("coach_plan_items")
    .select("id, item_type, plan_id, coach_plans!inner(user_id)")
    .eq("id", input.planItemId)
    .maybeSingle();

  if (!item || item.item_type !== "workout") {
    return { success: false, error: "That workout is no longer in your plan." };
  }

  const { error } = await supabase.from("coach_workout_logs").upsert(
    {
      user_id: user.id,
      plan_item_id: input.planItemId,
      completed_on: input.date,
      duration_min: input.durationMin ?? null,
    },
    { onConflict: "plan_item_id" }
  );

  if (error) return { success: false, error: "Failed to log this workout." };

  revalidatePath("/coach/planner");
  revalidatePath("/coach/progress");
  return { success: true };
}

/** Un-marks a workout. */
export async function deleteWorkoutLog(planItemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const { error } = await supabase
    .from("coach_workout_logs")
    .delete()
    .eq("user_id", user.id)
    .eq("plan_item_id", planItemId);

  if (error) return { success: false, error: "Failed to remove this entry." };

  revalidatePath("/coach/planner");
  revalidatePath("/coach/progress");
  return { success: true };
}

export interface AnalyticsInput {
  workoutDates: string[];
  foodDates: string[];
  scheduledWorkouts: number;
  goal: string;
}

/**
 * Raw activity data for the analytics dashboard. Returns dates only — the
 * arithmetic lives in lib/coach/analytics.ts so it stays pure and testable.
 */
export async function getActivityData(): Promise<AnalyticsInput> {
  const empty: AnalyticsInput = { workoutDates: [], foodDates: [], scheduledWorkouts: 0, goal: "maintain" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [{ data: workouts }, { data: foods }, { data: profile }, { data: plan }] = await Promise.all([
    supabase.from("coach_workout_logs").select("completed_on").eq("user_id", user.id),
    supabase.from("coach_food_logs").select("logged_on").eq("user_id", user.id),
    supabase.from("coach_profiles").select("goal").eq("user_id", user.id).maybeSingle(),
    supabase.from("coach_plans").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);

  // Adherence is measured against the workouts the active plan actually
  // scheduled. No active plan means no denominator, so adherence stays null.
  let scheduledWorkouts = 0;
  if (plan) {
    const { count } = await supabase
      .from("coach_plan_items")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .eq("item_type", "workout");
    scheduledWorkouts = count ?? 0;
  }

  return {
    workoutDates: (workouts ?? []).map((w) => w.completed_on),
    // De-duplicated: several meals on one day is still one active day.
    foodDates: [...new Set((foods ?? []).map((f) => f.logged_on))],
    scheduledWorkouts,
    goal: profile?.goal ?? "maintain",
  };
}
