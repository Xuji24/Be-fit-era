import { X } from "lucide-react";
import type { FoodLogRow } from "@/app/actions/coach-actions";

interface FoodLogListProps {
  logs: FoodLogRow[];
  onDelete: (logId: string) => void;
}

export default function FoodLogList({ logs, onDelete }: FoodLogListProps) {
  if (logs.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
        <p className="text-sm text-foreground/50 font-merriweather-sans">Nothing logged yet today.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-black/5 dark:border-white/5">
        <h3 className="text-sm font-semibold text-foreground font-raleway">Logged today</h3>
      </div>
      <div className="divide-y divide-black/5 dark:divide-white/5">
        {logs.map((log) => (
          <div key={log.id} className="px-6 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-merriweather-sans truncate">{log.foodName}</p>
              <p className="text-xs text-foreground/40 font-merriweather-sans">
                {log.kcal} kcal · {log.proteinG}g P · {log.carbsG}g C · {log.fatG}g F
                {log.source === "manual" && " · manual"}
              </p>
            </div>
            <button
              onClick={() => onDelete(log.id)}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-foreground/30 hover:text-[var(--brand-hover)] hover:bg-[var(--brand)]/10 transition-colors cursor-pointer"
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
