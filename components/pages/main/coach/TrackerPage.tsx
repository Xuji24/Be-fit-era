"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { sumMacros } from "@/lib/coach/nutrition";
import {
  getActivePlan,
  getDailyLogs,
  logPlannedMeal,
  logManualFood,
  deleteFoodLog,
  type ActivePlan,
  type FoodLogRow,
} from "@/app/actions/coach-actions";
import { getFoodLogHistory, type DaySummaryRow } from "@/app/actions/coach-history-actions";
import MacroSummary from "./component/macro-summary";
import PlannedMealsList from "./component/planned-meals-list";
import FoodLogList from "./component/food-log-list";
import FoodHistoryList from "./component/food-history-list";
import ManualFoodForm, { type ManualFoodFormValues } from "./component/manual-food-form";
import CoachHero from "./component/coach-hero";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TrackerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [targets, setTargets] = useState<{ kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }>({
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  const [pendingPlanItemId, setPendingPlanItemId] = useState<string | null>(null);
  const [pastDays, setPastDays] = useState<DaySummaryRow[]>([]);
  const [isPending, startTransition] = useTransition();

  // Computed once on mount, not on every render — Date.now() during render is impure.
  const [date] = useState(todayIso);

  const refreshLogs = useCallback(async () => {
    setLogs(await getDailyLogs(date));
  }, [date]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const [activePlan, dailyLogs, history, { data: profile }] = await Promise.all([
        getActivePlan(),
        getDailyLogs(date),
        getFoodLogHistory(),
        supabase
          .from("coach_profiles")
          .select("daily_kcal_target, protein_g_target, carbs_g_target, fat_g_target")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      setPlan(activePlan);
      setLogs(dailyLogs);
      setPastDays(history);
      setTargets({
        kcal: profile?.daily_kcal_target ?? null,
        proteinG: profile?.protein_g_target ?? null,
        carbsG: profile?.carbs_g_target ?? null,
        fatG: profile?.fat_g_target ?? null,
      });
      setLoading(false);
    }
    load();
  }, [router, date]);

  function handleLogPlannedMeal(planItemId: string) {
    setPendingPlanItemId(planItemId);
    startTransition(async () => {
      const result = await logPlannedMeal(planItemId, date);
      setPendingPlanItemId(null);
      if (!result.success) {
        toast.error(result.error ?? "Failed to log this meal.");
        return;
      }
      await refreshLogs();
    });
  }

  function handleLogManualFood(values: ManualFoodFormValues) {
    startTransition(async () => {
      const result = await logManualFood({ date, ...values });
      if (!result.success) {
        toast.error(result.error ?? "Failed to log this food.");
        return;
      }
      toast.success("Logged!");
      await refreshLogs();
    });
  }

  function handleDelete(logId: string) {
    startTransition(async () => {
      const result = await deleteFoodLog(logId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to remove this entry.");
        return;
      }
      await refreshLogs();
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-hover)]" />
      </div>
    );
  }

  const consumed = sumMacros(logs.map((l) => ({ kcal: l.kcal, proteinG: l.proteinG, carbsG: l.carbsG, fatG: l.fatG })));
  const loggedPlanItemIds = new Set(logs.filter((l) => l.planItemId).map((l) => l.planItemId as string));

  const todayDayIndex = plan ? Math.floor((new Date(date).getTime() - new Date(plan.startsOn).getTime()) / 86400000) : -1;
  const todaysMeals = plan?.items.filter((i) => i.itemType === "meal" && i.dayIndex === todayDayIndex) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <CoachHero icon={ClipboardList} title="Calorie Tracker" maxWidthClassName="max-w-6xl" />

      <div className="max-w-6xl mx-auto px-6 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <p className="text-sm text-foreground/60 font-merriweather-sans">
            {new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </p>

          <MacroSummary consumed={consumed} target={targets} />

          {plan && todayDayIndex >= 0 && todayDayIndex < plan.weeks * 7 ? (
            <PlannedMealsList
              meals={todaysMeals}
              loggedPlanItemIds={loggedPlanItemIds}
              pendingId={pendingPlanItemId}
              onLog={handleLogPlannedMeal}
            />
          ) : (
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
              <p className="text-sm text-foreground/50 font-merriweather-sans">
                No active plan covers today.{" "}
                <button onClick={() => router.push("/coach")} className="text-[var(--brand-hover)] font-semibold cursor-pointer">
                  Generate one
                </button>
                .
              </p>
            </div>
          )}

          <FoodLogList logs={logs} onDelete={handleDelete} />
          <ManualFoodForm isPending={isPending} onSubmit={handleLogManualFood} />
        </div>

        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-foreground font-raleway px-1">Past days</h2>
          <FoodHistoryList days={pastDays} todayIso={date} />
        </div>
      </div>
    </div>
  );
}
