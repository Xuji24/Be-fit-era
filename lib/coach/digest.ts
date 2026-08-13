/**
 * Weekly digest content for proactive coaching
 * (app/api/cron/coach-proactive/route.ts).
 *
 * Templated from real logged numbers, not an LLM call — confirmed with the
 * product owner as a deliberate choice: $0 cost and zero hallucination risk
 * on user-facing stats, versus a per-user AI call for prose that says the
 * same thing with more words.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { toDateKey } from "./streaks";

export interface WeekSummary {
  daysLogged: number;
  workoutsCompleted: number;
  avgKcal: number;
  avgProteinG: number;
}

/**
 * Aggregates one user's food + workout logs over a 7-day window
 * [weekStart, weekStart+6]. Takes any SupabaseClient so it works from both
 * the user-facing anon/cookie client and the cron's service-role client
 * without duplicating the query.
 */
export async function computeWeekSummary(
  supabase: SupabaseClient,
  userId: string,
  weekStart: Date
): Promise<WeekSummary> {
  const start = toDateKey(weekStart);
  const end = toDateKey(new Date(weekStart.getTime() + 6 * 86_400_000));

  const [{ data: foodLogs }, { data: workoutLogs }] = await Promise.all([
    supabase
      .from("coach_food_logs")
      .select("logged_on, kcal, protein_g")
      .eq("user_id", userId)
      .gte("logged_on", start)
      .lte("logged_on", end),
    supabase
      .from("coach_workout_logs")
      .select("completed_on")
      .eq("user_id", userId)
      .gte("completed_on", start)
      .lte("completed_on", end),
  ]);

  const rows = foodLogs ?? [];
  const daysLogged = new Set(rows.map((r: { logged_on: string }) => r.logged_on)).size;
  const totalKcal = rows.reduce((sum: number, r: { kcal: number }) => sum + r.kcal, 0);
  const totalProtein = rows.reduce((sum: number, r: { protein_g: number }) => sum + r.protein_g, 0);

  return {
    daysLogged,
    workoutsCompleted: (workoutLogs ?? []).length,
    avgKcal: daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0,
    avgProteinG: daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0,
  };
}

/** ISO week key for the weekly-digest dedup period, e.g. "2026-W33". */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Monday = 1 .. Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Plain template — no LLM call. See file header for why. */
export function formatDigestMessage(summary: WeekSummary): { title: string; body: string } {
  if (summary.daysLogged === 0) {
    return {
      title: "Your week in review",
      body: "No logs this week — even a quick entry keeps your streak and your plan in sync. Open the tracker when you're ready.",
    };
  }

  const dayWord = summary.daysLogged === 1 ? "day" : "days";
  const workoutWord = summary.workoutsCompleted === 1 ? "workout" : "workouts";

  return {
    title: "Your week in review",
    body: `You logged food on ${summary.daysLogged}/7 ${dayWord} and completed ${summary.workoutsCompleted} ${workoutWord}, averaging ${summary.avgKcal} kcal and ${summary.avgProteinG}g protein a day. Keep it up!`,
  };
}
