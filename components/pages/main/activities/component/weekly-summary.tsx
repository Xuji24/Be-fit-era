"use client";

import type { WeeklyStat } from "@/data/activities-data";

const WeeklySummary = ({ data }: { data: WeeklyStat[] }) => {
  const maxDistance = Math.max(...data.map((d) => d.distance));
  const totalDistance = data.reduce((sum, d) => sum + d.distance, 0);
  const activeDays = data.filter((d) => d.distance > 0).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-foreground font-raleway">
            Weekly Summary
          </h2>
          <p className="text-sm text-foreground/50 mt-0.5">
            Jun 12 – Jun 18, 2025
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-[var(--brand-hover)]">
              {totalDistance.toFixed(1)} km
            </p>
            <p className="text-xs text-foreground/40 uppercase tracking-wider">
              Total
            </p>
          </div>
          <div className="w-px bg-black/10 dark:bg-white/10" />
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {activeDays}/7
            </p>
            <p className="text-xs text-foreground/40 uppercase tracking-wider">
              Active
            </p>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/5 dark:border-white/5 flex items-end gap-2 sm:gap-4 h-52">
        {data.map((day) => {
          const heightPercent =
            maxDistance > 0 ? (day.distance / maxDistance) * 100 : 0;
          const isToday = day.day === "Wed"; // simulated
          return (
            <div
              key={day.day}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <span className="text-xs font-medium text-foreground/60">
                {day.distance > 0 ? `${day.distance}` : "—"}
              </span>
              <div className="w-full flex justify-center">
                <div
                  className={`w-full max-w-10 rounded-lg transition-all ${
                    day.distance > 0
                      ? "bg-[var(--brand)]"
                      : "bg-black/5 dark:bg-white/5"
                  } ${isToday ? "ring-2 ring-[var(--brand-hover)] ring-offset-2 ring-offset-white dark:ring-offset-[#1C1C1E]" : ""}`}
                  style={{ height: `${Math.max(heightPercent, 6)}%` }}
                />
              </div>
              <span
                className={`text-xs font-medium ${
                  isToday
                    ? "text-[var(--brand-hover)] font-bold"
                    : "text-foreground/50"
                }`}
              >
                {day.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklySummary;
