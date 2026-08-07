"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { logWeightCheckIn, getWeightHistory, deleteWeightCheckIn, type WeightLogRow } from "@/app/actions/coach-weight-actions";
import { getActivityData, type AnalyticsInput } from "@/app/actions/coach-workout-actions";
import { buildAnalytics } from "@/lib/coach/analytics";
import AnalyticsPanel from "./component/analytics-panel";
import BmiTrendChart from "./component/bmi-trend-chart";
import WeightCheckInForm from "./component/weight-checkin-form";
import WeightHistoryList from "./component/weight-history-list";
import CoachHero from "./component/coach-hero";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProgressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<WeightLogRow[]>([]);
  const [activity, setActivity] = useState<AnalyticsInput | null>(null);
  const [isPending, startTransition] = useTransition();

  const [date] = useState(todayIso);

  const refreshHistory = useCallback(async () => {
    const [weights, activityData] = await Promise.all([getWeightHistory(), getActivityData()]);
    setHistory(weights);
    setActivity(activityData);
  }, []);

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

      const { data: profile } = await supabase.from("coach_profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (!profile) {
        router.push("/coach/onboarding");
        return;
      }

      await refreshHistory();
      setLoading(false);
    }
    load();
  }, [router, refreshHistory]);

  function handleLogWeight(weightKg: number, bodyFatPct?: number) {
    startTransition(async () => {
      const result = await logWeightCheckIn({ date, weightKg, bodyFatPct });
      if (!result.success) {
        toast.error(result.error ?? "Failed to log your weigh-in.");
        return;
      }
      toast.success("Weigh-in logged!");
      await refreshHistory();
    });
  }

  function handleDeleteWeight(loggedOn: string) {
    startTransition(async () => {
      const result = await deleteWeightCheckIn(loggedOn);
      if (!result.success) {
        toast.error(result.error ?? "Failed to remove this entry.");
        return;
      }
      await refreshHistory();
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF5733]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212]">
      <CoachHero icon={TrendingUp} title="Progress" />

      <div className="max-w-6xl mx-auto px-6 pb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activity && (
            <AnalyticsPanel
              summary={buildAnalytics({
                workoutDates: activity.workoutDates,
                foodDates: activity.foodDates,
                weightHistory: history.map((h) => ({
                  date: h.loggedOn,
                  weightKg: h.weightKg,
                  bodyFatPct: h.bodyFatPct,
                })),
                scheduledWorkouts: activity.scheduledWorkouts,
                goal: activity.goal,
              })}
            />
          )}

          <BmiTrendChart history={history} />
          <WeightCheckInForm isPending={isPending} onSubmit={handleLogWeight} />
        </div>

        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway px-1">
            Weigh-in history
          </h2>
          <WeightHistoryList history={history} onDelete={handleDeleteWeight} />
        </div>
      </div>
    </div>
  );
}
