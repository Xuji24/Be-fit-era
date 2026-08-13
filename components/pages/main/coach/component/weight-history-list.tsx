import { X } from "lucide-react";
import type { WeightLogRow } from "@/app/actions/coach-weight-actions";

interface WeightHistoryListProps {
  history: WeightLogRow[];
  onDelete: (loggedOn: string) => void;
}

export default function WeightHistoryList({ history, onDelete }: WeightHistoryListProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans text-center py-8">
        No weigh-ins logged yet.
      </p>
    );
  }

  const sorted = [...history].sort((a, b) => (a.loggedOn < b.loggedOn ? 1 : -1));

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="divide-y divide-black/5 dark:divide-white/5">
        {sorted.map((entry) => (
          <div key={entry.loggedOn} className="px-5 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#1A1A1A] dark:text-white font-merriweather-sans">
                Week of {new Date(entry.loggedOn).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
              <p className="text-xs text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans">
                {entry.weightKg}kg · BMI {entry.bmi}
              </p>
            </div>
            <button
              onClick={() => onDelete(entry.loggedOn)}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#1A1A1A]/30 dark:text-white/30 hover:text-[#FF5733] hover:bg-[#FF5733]/10 transition-colors cursor-pointer"
              aria-label="Remove entry"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
