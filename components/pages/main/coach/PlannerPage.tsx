"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CalendarDays, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { getActivePlan, type ActivePlan } from "@/app/actions/coach-actions";
import { logWorkoutComplete, deleteWorkoutLog } from "@/app/actions/coach-workout-actions";
import { getPlanHistory, type PlanSummaryRow } from "@/app/actions/coach-history-actions";
import DayCard from "./component/day-card";
import CoachHero from "./component/coach-hero";
import PlanHistoryList from "./component/plan-history-list";
import HistoryPanel from "./component/history-panel";
import HistoryButton from "./component/history-button";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function PlannerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [kcalTarget, setKcalTarget] = useState<number | null>(null);
  const [planHistory, setPlanHistory] = useState<PlanSummaryRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

      const [activePlan, history, { data: profile }] = await Promise.all([
        getActivePlan(),
        getPlanHistory(),
        supabase.from("coach_profiles").select("daily_kcal_target").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!activePlan) {
        router.push("/coach");
        return;
      }

      setPlan(activePlan);
      setCompletedIds(new Set(activePlan.completedItemIds));
      setPlanHistory(history);
      setKcalTarget(profile?.daily_kcal_target ?? null);
      setLoading(false);
    }
    load();
  }, [router]);

  function handleToggleWorkout(planItemId: string, done: boolean) {
    setPendingItemId(planItemId);

    // Optimistic: flip immediately, roll back if the server rejects it.
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (done) next.add(planItemId);
      else next.delete(planItemId);
      return next;
    });

    startTransition(async () => {
      const result = done
        ? await logWorkoutComplete({ planItemId, date: new Date().toISOString().slice(0, 10) })
        : await deleteWorkoutLog(planItemId);

      setPendingItemId(null);

      if (!result.success) {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          if (done) next.delete(planItemId);
          else next.add(planItemId);
          return next;
        });
        toast.error(result.error ?? "Failed to update this workout.");
      }
    });
  }

  if (loading || !plan) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF5733]" />
      </div>
    );
  }

  const totalDays = plan.weeks * 7;
  const startDate = new Date(plan.startsOn);

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212]">
      <CoachHero
        icon={CalendarDays}
        title="Your Plan"
        maxWidthClassName="max-w-6xl"
        actions={<HistoryButton onClick={() => setHistoryOpen(true)} label="Past plans" />}
      />

      <div className="max-w-6xl mx-auto px-6 pb-16 space-y-6">
        {plan.summary && (
          <p className="text-sm text-[#1A1A1A]/60 dark:text-white/60 font-merriweather-sans">{plan.summary}</p>
        )}

        {plan.healthTips.length > 0 && (
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-[#FFB800]" />
              <h2 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">
                Tips for your goal
              </h2>
            </div>
            <ul className="space-y-2">
              {plan.healthTips.map((tip, i) => (
                <li
                  key={i}
                  className="text-sm text-[#1A1A1A]/70 dark:text-white/70 font-merriweather-sans flex gap-2.5"
                >
                  <span className="text-[#FF5733] shrink-0">·</span>
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans">
              General wellness guidance, not medical advice.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: totalDays }, (_, dayIndex) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + dayIndex);
            const dayLabel = `${DAY_NAMES[date.getDay()]}, ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

            const dayItems = plan.items.filter((i) => i.dayIndex === dayIndex);
            return (
              <DayCard
                key={dayIndex}
                dayIndex={dayIndex}
                dayLabel={dayLabel}
                meals={dayItems.filter((i) => i.itemType === "meal")}
                workouts={dayItems.filter((i) => i.itemType === "workout")}
                kcalTarget={kcalTarget}
                completedItemIds={completedIds}
                pendingItemId={pendingItemId}
                onToggleWorkout={handleToggleWorkout}
              />
            );
          })}
        </div>
      </div>

      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} title="Past plans">
        <PlanHistoryList plans={planHistory} />
      </HistoryPanel>
    </div>
  );
}
