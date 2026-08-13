/**
 * Logging-streak computation for proactive coaching
 * (app/api/cron/coach-proactive/route.ts).
 *
 * UTC throughout, matching the periodKey() convention in lib/coach/tiers.ts —
 * a local-midnight boundary would need a per-user timezone the server
 * doesn't reliably have.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const ENGAGEMENT_WINDOW_DAYS = 60;

/** Formats a Date as its UTC calendar-day key, e.g. "2026-08-08". */
export function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Consecutive-day streak ending today (or yesterday, as a grace period for a
 * user who simply hasn't logged yet today). `dates` is any list of
 * "YYYY-MM-DD" strings — duplicates and order don't matter.
 */
export function computeLoggingStreak(dates: string[], today: Date): number {
  const dateSet = new Set(dates);

  let cursor: Date;
  if (dateSet.has(toDateKey(today))) {
    cursor = today;
  } else if (dateSet.has(toDateKey(addDays(today, -1)))) {
    cursor = addDays(today, -1);
  } else {
    return 0;
  }

  let streak = 0;
  while (dateSet.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Whole days since the most recent date in `dates`, or null if `dates` is empty. */
export function daysSinceLastLog(dates: string[], today: Date): number | null {
  if (dates.length === 0) return null;
  const mostRecent = dates.reduce((max, d) => (d > max ? d : max));
  const diffMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
    Date.parse(`${mostRecent}T00:00:00Z`);
  return Math.floor(diffMs / 86_400_000);
}

/**
 * Distinct engagement dates (food logged OR workout completed) over the last
 * ENGAGEMENT_WINDOW_DAYS — the raw input to computeLoggingStreak/daysSinceLastLog.
 */
export async function getEngagementDates(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const since = toDateKey(addDays(new Date(), -ENGAGEMENT_WINDOW_DAYS));

  const [{ data: foodLogs }, { data: workoutLogs }] = await Promise.all([
    supabase.from("coach_food_logs").select("logged_on").eq("user_id", userId).gte("logged_on", since),
    supabase.from("coach_workout_logs").select("completed_on").eq("user_id", userId).gte("completed_on", since),
  ]);

  const dates = new Set<string>();
  (foodLogs ?? []).forEach((r: { logged_on: string }) => dates.add(r.logged_on));
  (workoutLogs ?? []).forEach((r: { completed_on: string }) => dates.add(r.completed_on));
  return [...dates];
}
