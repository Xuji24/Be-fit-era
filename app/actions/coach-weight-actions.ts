"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./coach-actions";

export interface WeightCheckInInput {
  date: string;
  weightKg: number;
  /** Optional, from a smart scale or calipers. Enables measured body-composition analytics. */
  bodyFatPct?: number;
  notes?: string;
}

/**
 * Logs a weigh-in. height_cm is read from coach_profiles and copied onto the
 * row at insert time — see coach_weight_logs' table comment for why this
 * must not be a join: a later height correction must not rewrite past BMI.
 * Upserts on (user_id, logged_on) so re-logging the same day replaces intent.
 */
export async function logWeightCheckIn(input: WeightCheckInInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  if (!(input.weightKg >= 30 && input.weightKg <= 300)) {
    return { success: false, error: "Weight must be between 30 and 300 kg." };
  }
  if (input.bodyFatPct !== undefined && !(input.bodyFatPct >= 3 && input.bodyFatPct <= 70)) {
    return { success: false, error: "Body fat % must be between 3 and 70." };
  }

  const { data: profile } = await supabase.from("coach_profiles").select("height_cm").eq("user_id", user.id).maybeSingle();
  if (!profile) return { success: false, error: "Complete onboarding before logging a weigh-in." };

  const { error } = await supabase.from("coach_weight_logs").upsert(
    {
      user_id: user.id,
      logged_on: input.date,
      weight_kg: input.weightKg,
      height_cm: profile.height_cm,
      body_fat_pct: input.bodyFatPct ?? null,
      notes: input.notes?.trim() || null,
    },
    { onConflict: "user_id,logged_on" }
  );

  if (error) return { success: false, error: "Failed to log your weigh-in." };

  revalidatePath("/coach/progress");
  return { success: true };
}

export interface WeightLogRow {
  loggedOn: string;
  weightKg: number;
  bmi: number;
  bodyFatPct: number | null;
  notes: string | null;
}

/** Full weigh-in history, oldest first — feeds the trend chart. */
export async function getWeightHistory(): Promise<WeightLogRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("coach_weight_logs")
    .select("logged_on, weight_kg, bmi, body_fat_pct, notes")
    .eq("user_id", user.id)
    .order("logged_on");

  return (data ?? []).map((r) => ({
    loggedOn: r.logged_on,
    weightKg: r.weight_kg,
    bmi: r.bmi,
    bodyFatPct: r.body_fat_pct,
    notes: r.notes,
  }));
}

/** Removes a single weigh-in entry. */
export async function deleteWeightCheckIn(loggedOn: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const { error } = await supabase.from("coach_weight_logs").delete().eq("user_id", user.id).eq("logged_on", loggedOn);
  if (error) return { success: false, error: "Failed to remove this entry." };

  revalidatePath("/coach/progress");
  return { success: true };
}
