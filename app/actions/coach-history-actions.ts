"use server";

import { createClient } from "@/lib/supabase/server";

export interface PlanSummaryRow {
  id: string;
  version: number;
  status: "active" | "archived";
  startsOn: string;
  weeks: number;
  summary: string | null;
  itemCount: number;
}

/** Every plan version for the user, newest first — the record of past plans. */
export async function getPlanHistory(): Promise<PlanSummaryRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: plans } = await supabase
    .from("coach_plans")
    .select("id, version, status, starts_on, weeks, summary")
    .eq("user_id", user.id)
    .order("version", { ascending: false });
  if (!plans?.length) return [];

  const { data: counts } = await supabase
    .from("coach_plan_items")
    .select("plan_id")
    .in("plan_id", plans.map((p) => p.id));

  const countByPlan = new Map<string, number>();
  (counts ?? []).forEach((row) => countByPlan.set(row.plan_id, (countByPlan.get(row.plan_id) ?? 0) + 1));

  return plans.map((p) => ({
    id: p.id,
    version: p.version,
    status: p.status,
    startsOn: p.starts_on,
    weeks: p.weeks,
    summary: p.summary,
    itemCount: countByPlan.get(p.id) ?? 0,
  }));
}

export interface DaySummaryRow {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entryCount: number;
}

/** Per-day food log totals for the last N days — the tracker's missing history view. */
export async function getFoodLogHistory(days = 30): Promise<DaySummaryRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabase
    .from("coach_food_logs")
    .select("logged_on, kcal, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .gte("logged_on", since.toISOString().slice(0, 10))
    .order("logged_on", { ascending: false });

  const byDay = new Map<string, DaySummaryRow>();
  (data ?? []).forEach((log) => {
    const existing = byDay.get(log.logged_on) ?? {
      date: log.logged_on,
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      entryCount: 0,
    };
    existing.kcal += log.kcal;
    existing.proteinG += log.protein_g;
    existing.carbsG += log.carbs_g;
    existing.fatG += log.fat_g;
    existing.entryCount += 1;
    byDay.set(log.logged_on, existing);
  });

  return [...byDay.values()];
}
