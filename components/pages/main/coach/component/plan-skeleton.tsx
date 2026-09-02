// Mimics the shape of the planner's day-card grid so the wait for a real
// Groq generation (roughly 7-20s) previews what's coming instead of just
// signaling "something is happening."
function SkeletonDayCard() {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-2.5 w-14 rounded bg-[var(--brand)]/25 skeleton-shimmer" />
          <div className="h-3 w-24 rounded skeleton-shimmer" />
        </div>
        <div className="h-2.5 w-16 rounded skeleton-shimmer" />
      </div>
      <div className="p-5 space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg skeleton-shimmer shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-2 w-16 rounded skeleton-shimmer" />
              <div className="h-3 rounded skeleton-shimmer" style={{ width: `${60 + i * 8}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlanSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
      {Array.from({ length: 6 }, (_, i) => (
        <SkeletonDayCard key={i} />
      ))}
    </div>
  );
}
