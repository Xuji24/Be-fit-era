import type { DaySummaryRow } from "@/app/actions/coach-history-actions";

interface FoodHistoryListProps {
  days: DaySummaryRow[];
  todayIso: string;
}

export default function FoodHistoryList({ days, todayIso }: FoodHistoryListProps) {
  const pastDays = days.filter((d) => d.date !== todayIso).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (pastDays.length === 0) {
    return (
      <p className="text-sm text-foreground/40 font-merriweather-sans text-center py-8">
        No past days logged yet.
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="divide-y divide-black/5 dark:divide-white/5">
        {pastDays.map((day) => (
          <div key={day.date} className="px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-foreground font-merriweather-sans">
              {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <p className="text-xs text-foreground/40 font-merriweather-sans">
              {day.kcal} kcal · {day.entryCount} {day.entryCount === 1 ? "entry" : "entries"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
