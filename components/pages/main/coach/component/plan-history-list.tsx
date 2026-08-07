import type { PlanSummaryRow } from "@/app/actions/coach-history-actions";

interface PlanHistoryListProps {
  plans: PlanSummaryRow[];
}

export default function PlanHistoryList({ plans }: PlanHistoryListProps) {
  const archived = plans.filter((p) => p.status === "archived");
  if (archived.length === 0) {
    return (
      <p className="text-sm text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans text-center py-8">
        No past plans yet.
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="divide-y divide-black/5 dark:divide-white/5">
        {archived.map((plan) => (
          <div key={plan.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-[#1A1A1A] dark:text-white font-merriweather-sans">
                Version {plan.version} · {new Date(plan.startsOn).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
              {plan.summary && (
                <p className="text-xs text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans truncate">{plan.summary}</p>
              )}
            </div>
            <p className="text-xs text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans shrink-0">{plan.itemCount} items</p>
          </div>
        ))}
      </div>
    </div>
  );
}
