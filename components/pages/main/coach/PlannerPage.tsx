"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CalendarDays, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { getActivePlan, type ActivePlan } from "@/app/actions/coach-actions";
import { logWorkoutComplete, deleteWorkoutLog } from "@/app/actions/coach-workout-actions";
import { getPlanHistory, type PlanSummaryRow } from "@/app/actions/coach-history-actions";
import DayCard from "./component/day-card";
import WeekStrip from "./component/week-strip";
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
  const [activeWeek, setActiveWeek] = useState(0);
  const [, startTransition] = useTransition();
  const weekTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [weekPill, setWeekPill] = useState<{ left: number; width: number } | null>(null);

  // Measures the active tab so the pill behind it can slide there, rather
  // than the selected state just teleporting between colors.
  useEffect(() => {
    const el = weekTabRefs.current[activeWeek];
    if (el) setWeekPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeWeek, plan?.weeks]);

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
      // Open on the week the user is actually in, not always week 1.
      const dayOffset = Math.floor(
        (new Date().setHours(0, 0, 0, 0) - new Date(activePlan.startsOn).setHours(0, 0, 0, 0)) / 86_400_000
      );
      if (dayOffset >= 0 && dayOffset < activePlan.weeks * 7) {
        setActiveWeek(Math.floor(dayOffset / 7));
      }
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

  const startDate = new Date(plan.startsOn);

  // Which plan day is today, or null if the plan hasn't started / has ended.
  // Used to pick the default week tab and to auto-open one card.
  const msPerDay = 86_400_000;
  const todayIndex = Math.floor(
    (new Date().setHours(0, 0, 0, 0) - new Date(plan.startsOn).setHours(0, 0, 0, 0)) / msPerDay
  );
  const currentDayIndex = todayIndex >= 0 && todayIndex < plan.weeks * 7 ? todayIndex : null;

  // A "week" is 7 consecutive plan days (dayIndex), but plan.startsOn is
  // whatever raw date the plan happened to be generated on — there's no
  // guarantee it's a Monday. Left in dayIndex order, a plan started on a
  // Saturday would render the strip as Sat, Sun, Mon, ..., Fri: Saturday
  // first, and Sunday stranded right after it instead of next to Saturday
  // at the end. Sorting by calendar weekday (Mon -> Sun) fixes the display
  // without touching what dayIndex means for item lookup below.
  const weekDays = Array.from({ length: 7 }, (_, i) => activeWeek * 7 + i).sort((a, b) => {
    const weekdayOf = (dayIndex: number) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayIndex);
      return (date.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
    };
    return weekdayOf(a) - weekdayOf(b);
  });

  const stripDays = weekDays.map((dayIndex) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayIndex);
    const dayItems = plan.items.filter((i) => i.dayIndex === dayIndex);
    const dayWorkouts = dayItems.filter((i) => i.itemType === "workout");
    return {
      dayIndex,
      initial: DAY_NAMES[date.getDay()].slice(0, 1),
      weekday: DAY_NAMES[date.getDay()],
      workoutCount: dayWorkouts.length,
      workoutsDone: dayWorkouts.filter((w) => completedIds.has(w.id)).length,
      hasMeals: dayItems.some((i) => i.itemType === "meal"),
      isToday: dayIndex === currentDayIndex,
    };
  });

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

        {/* Week tabs: a 4-week Pro plan is 28 days, which as one flat list of
            expanded cards buried the day the user actually needs today. */}
        {plan.weeks > 1 && (
          <div
            role="tablist"
            aria-label="Plan weeks"
            className="relative flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 bg-[#F5F5F0] dark:bg-[#2A2A2E] rounded-xl w-fit"
          >
            {weekPill && (
              <span
                aria-hidden="true"
                className="absolute top-1 h-[calc(100%-8px)] rounded-lg bg-[#FF5733] transition-[transform,width] duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]"
                style={{ width: weekPill.width, transform: `translateX(${weekPill.left}px)` }}
              />
            )}
            {Array.from({ length: plan.weeks }, (_, week) => {
              const selected = week === activeWeek;
              const isCurrent = currentDayIndex !== null && Math.floor(currentDayIndex / 7) === week;
              return (
                <button
                  key={week}
                  ref={(el) => {
                    weekTabRefs.current[week] = el;
                  }}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveWeek(week)}
                  className={`relative z-10 shrink-0 px-4 py-2 rounded-lg text-sm font-semibold font-raleway transition-colors cursor-pointer ${
                    selected
                      ? "text-white"
                      : "text-[#1A1A1A]/60 dark:text-white/60 hover:text-[#FF5733]"
                  }`}
                >
                  Week {week + 1}
                  {isCurrent && !selected && <span className="ml-1.5 text-[#FF5733]">•</span>}
                </button>
              );
            })}
          </div>
        )}

        <WeekStrip days={stripDays} />

        {/* items-start: grid defaults to align-items:stretch, which was making
            every collapsed card in a row grow to the height of the one expanded
            card beside it. Set on the grid rather than the card so the skeleton
            grid below can't drift out of sync. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {weekDays.map((dayIndex) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + dayIndex);

            const dayItems = plan.items.filter((i) => i.dayIndex === dayIndex);
            return (
              <DayCard
                key={dayIndex}
                dayIndex={dayIndex}
                weekday={DAY_NAMES[date.getDay()]}
                dateLabel={date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                isToday={dayIndex === currentDayIndex}
                meals={dayItems.filter((i) => i.itemType === "meal")}
                workouts={dayItems.filter((i) => i.itemType === "workout")}
                kcalTarget={kcalTarget}
                completedItemIds={completedIds}
                pendingItemId={pendingItemId}
                onToggleWorkout={handleToggleWorkout}
                // Only today opens by itself; everything else is a summary row
                // until asked for. On a plan that isn't running yet, the first
                // day stands in so the page never opens fully collapsed.
                defaultExpanded={
                  currentDayIndex !== null ? dayIndex === currentDayIndex : dayIndex === 0
                }
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
