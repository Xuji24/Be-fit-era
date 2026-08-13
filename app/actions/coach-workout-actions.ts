"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { weekStartKey } from "@/lib/coach/weekly";
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
  /** Aligned by index with workoutDates. Null entries are logs with no recorded duration. */
  workoutMinutes: (number | null)[];
  foodDates: string[];
  scheduledWorkouts: number;
  goal: string;
  /** Breakdown of scheduledWorkouts against the active plan's calendar — the adherence donut. */
  adherence: { completed: number; missed: number; remaining: number };
  /** Sum of the current ISO week's logged macros — the macro-split donut. */
  weekMacros: { proteinG: number; carbsG: number; fatG: number };
}

const EMPTY_ANALYTICS_INPUT: AnalyticsInput = {
  workoutDates: [],
  workoutMinutes: [],
  foodDates: [],
  scheduledWorkouts: 0,
  goal: "maintain",
  adherence: { completed: 0, missed: 0, remaining: 0 },
  weekMacros: { proteinG: 0, carbsG: 0, fatG: 0 },
};

/**
 * Raw activity data for the analytics dashboard. Returns dates and totals only
 * — the arithmetic that turns them into chart-ready shapes lives in
 * lib/coach/analytics.ts and lib/coach/weekly.ts so it stays pure and testable.
 */
export async function getActivityData(): Promise<AnalyticsInput> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_ANALYTICS_INPUT;

  const weekStart = weekStartKey(new Date());

  const [{ data: workouts }, { data: foods }, { data: weekFoods }, { data: profile }, { data: plan }] =
    await Promise.all([
      supabase.from("coach_workout_logs").select("completed_on, duration_min, plan_item_id").eq("user_id", user.id),
      supabase.from("coach_food_logs").select("logged_on").eq("user_id", user.id),
      supabase
        .from("coach_food_logs")
        .select("protein_g, carbs_g, fat_g")
        .eq("user_id", user.id)
        .gte("logged_on", weekStart),
      supabase.from("coach_profiles").select("goal").eq("user_id", user.id).maybeSingle(),
      supabase.from("coach_plans").select("id, starts_on").eq("user_id", user.id).eq("status", "active").maybeSingle(),
    ]);

  // Adherence is measured against the workouts the active plan actually
  // scheduled, split into three buckets: done, due-but-skipped, and not due
  // yet. No active plan means no calendar to measure against.
  let scheduledWorkouts = 0;
  let adherence = { completed: 0, missed: 0, remaining: 0 };
  if (plan) {
    const { data: items } = await supabase
      .from("coach_plan_items")
      .select("id, day_index")
      .eq("plan_id", plan.id)
      .eq("item_type", "workout");

    scheduledWorkouts = items?.length ?? 0;

    if (items && items.length > 0) {
      const completedItemIds = new Set((workouts ?? []).map((w) => w.plan_item_id).filter((id): id is string => id !== null));
      const elapsedDays = Math.floor(
        (new Date().setHours(0, 0, 0, 0) - new Date(plan.starts_on).setHours(0, 0, 0, 0)) / 86_400_000
      );

      let completed = 0;
      let missed = 0;
      for (const item of items) {
        const done = completedItemIds.has(item.id);
        if (done) completed += 1;
        // "Due" means the item's day has arrived. A future item that's already
        // been completed ahead of schedule still counts as completed, not missed.
        else if (item.day_index < elapsedDays) missed += 1;
      }
      adherence = { completed, missed, remaining: items.length - completed - missed };
    }
  }

  const weekMacros = (weekFoods ?? []).reduce(
    (totals, f) => ({
      proteinG: totals.proteinG + f.protein_g,
      carbsG: totals.carbsG + f.carbs_g,
      fatG: totals.fatG + f.fat_g,
    }),
    { proteinG: 0, carbsG: 0, fatG: 0 }
  );

  return {
    workoutDates: (workouts ?? []).map((w) => w.completed_on),
    workoutMinutes: (workouts ?? []).map((w) => w.duration_min),
    // De-duplicated: several meals on one day is still one active day.
    foodDates: [...new Set((foods ?? []).map((f) => f.logged_on))],
    scheduledWorkouts,
    goal: profile?.goal ?? "maintain",
    adherence,
    weekMacros,
  };
}
