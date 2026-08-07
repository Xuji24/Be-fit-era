import { Check, Utensils } from "lucide-react";
import type { PlanItemRow } from "@/app/actions/coach-actions";

const SLOT_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

interface PlannedMealsListProps {
  meals: PlanItemRow[];
  loggedPlanItemIds: Set<string>;
  pendingId: string | null;
  onLog: (planItemId: string) => void;
}

export default function PlannedMealsList({ meals, loggedPlanItemIds, pendingId, onLog }: PlannedMealsListProps) {
  const sorted = [...meals].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
        <p className="text-sm text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans">No meals planned for today.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-black/5 dark:border-white/5">
        <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">Today&apos;s planned meals</h3>
      </div>
      <div className="divide-y divide-black/5 dark:divide-white/5">
        {sorted.map((meal) => {
          const logged = loggedPlanItemIds.has(meal.id);
          const isPending = pendingId === meal.id;

          return (
            <div key={meal.id} className="px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1A1A1A]/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                <Utensils className="w-4 h-4 text-[#1A1A1A]/50 dark:text-white/50" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-[#1A1A1A]/40 dark:text-white/40 uppercase tracking-wider font-raleway">
                  {SLOT_LABELS[meal.slot] ?? meal.slot}
                </p>
                <p className="text-sm text-[#1A1A1A] dark:text-white font-merriweather-sans truncate">{meal.title}</p>
                <p className="text-xs text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans">{meal.kcal} kcal</p>
              </div>
              <button
                onClick={() => !logged && onLog(meal.id)}
                disabled={logged || isPending}
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:cursor-default ${
                  logged
                    ? "bg-[#FF5733] text-white"
                    : "border-2 border-[#1A1A1A]/15 dark:border-white/15 hover:border-[#FF5733] text-transparent hover:text-[#FF5733]/50"
                }`}
                aria-label={logged ? "Logged" : "Mark as eaten"}
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
