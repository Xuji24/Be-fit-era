"use client";

import { useState } from "react";
import { Check, Dumbbell, Loader2, Utensils } from "lucide-react";
import type { PlanItemRow } from "@/app/actions/coach-actions";
import ExerciseDemoModal from "./exercise-demo-modal";

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  am: "Morning",
  pm: "Evening",
};

const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3, am: 0, pm: 1 };

/** details.exercises[] is untyped JSONB on the way in — narrow it defensively at the boundary. */
function getExerciseNames(details: Record<string, unknown>): string[] {
  const exercises = details.exercises;
  if (!Array.isArray(exercises)) return [];
  return exercises
    .map((e) => (e && typeof e === "object" && typeof (e as { name?: unknown }).name === "string" ? (e as { name: string }).name : null))
    .filter((name): name is string => name !== null);
}

interface DayCardProps {
  dayIndex: number;
  dayLabel: string;
  meals: PlanItemRow[];
  workouts: PlanItemRow[];
  kcalTarget: number | null;
  completedItemIds: Set<string>;
  pendingItemId: string | null;
  onToggleWorkout: (planItemId: string, done: boolean) => void;
}

export default function DayCard({
  dayIndex,
  dayLabel,
  meals,
  workouts,
  kcalTarget,
  completedItemIds,
  pendingItemId,
  onToggleWorkout,
}: DayCardProps) {
  const sortedMeals = [...meals].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  const sortedWorkouts = [...workouts].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  const dayKcal = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const [activeExercise, setActiveExercise] = useState<string | null>(null);

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[#FF5733] uppercase tracking-wider font-raleway">Day {dayIndex + 1}</p>
          <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">{dayLabel}</p>
        </div>
        {kcalTarget !== null && (
          <p className="text-xs text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans">
            {dayKcal} / {kcalTarget} kcal
          </p>
        )}
      </div>

      <div className="p-5 space-y-4">
        {sortedWorkouts.map((w) => {
          const done = completedItemIds.has(w.id);
          const pending = pendingItemId === w.id;

          return (
            <div key={w.id} className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  done ? "bg-[#FF5733]" : "bg-[#FF5733]/10"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Dumbbell className="w-3.5 h-3.5 text-[#FF5733]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-[#1A1A1A]/40 dark:text-white/40 uppercase tracking-wider font-raleway">
                  {SLOT_LABELS[w.slot] ?? w.slot}
                </p>
                <p
                  className={`text-sm font-merriweather-sans ${
                    done
                      ? "text-[#1A1A1A]/40 dark:text-white/40 line-through"
                      : "text-[#1A1A1A] dark:text-white"
                  }`}
                >
                  {w.title}
                </p>

                {(() => {
                  const exerciseNames = getExerciseNames(w.details);
                  if (exerciseNames.length === 0) return null;
                  return (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {exerciseNames.map((name, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveExercise(name)}
                          className="px-2 py-1 rounded-lg text-xs font-merriweather-sans bg-[#F5F5F0] dark:bg-[#2A2A2E] text-[#1A1A1A]/70 dark:text-white/70 hover:text-[#FF5733] hover:bg-[#FF5733]/10 transition-colors cursor-pointer"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                <button
                  onClick={() => onToggleWorkout(w.id, !done)}
                  disabled={pending}
                  className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-raleway transition-colors cursor-pointer disabled:opacity-50 ${
                    done
                      ? "bg-[#F5F5F0] dark:bg-[#2A2A2E] text-[#1A1A1A]/60 dark:text-white/60"
                      : "bg-[#FF5733]/10 text-[#FF5733] hover:bg-[#FF5733]/20"
                  }`}
                >
                  {pending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : done ? (
                    "Undo"
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      Mark done
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {sortedMeals.map((m) => (
          <div key={m.id} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1A1A1A]/5 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Utensils className="w-3.5 h-3.5 text-[#1A1A1A]/50 dark:text-white/50" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold text-[#1A1A1A]/40 dark:text-white/40 uppercase tracking-wider font-raleway">
                  {SLOT_LABELS[m.slot] ?? m.slot}
                </p>
                <p className="text-[10px] text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans shrink-0">{m.kcal} kcal</p>
              </div>
              <p className="text-sm text-[#1A1A1A] dark:text-white font-merriweather-sans">{m.title}</p>
            </div>
          </div>
        ))}

        {sortedMeals.length === 0 && sortedWorkouts.length === 0 && (
          <p className="text-sm text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans">Nothing scheduled.</p>
        )}
      </div>

      <ExerciseDemoModal exerciseName={activeExercise} onClose={() => setActiveExercise(null)} />
    </div>
  );
}
