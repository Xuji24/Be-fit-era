"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_STATUS, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_COLOR_SCHEME_CLASS } from "@/lib/charts/theme";

interface AdherenceDonutProps {
  completed: number;
  missed: number;
  remaining: number;
}

/**
 * Completed vs missed vs not-yet-due, against what the active plan actually
 * scheduled. "Missed" only counts a workout once its day has passed — a
 * workout scheduled for tomorrow isn't a missed one yet, it's upcoming.
 */
export default function AdherenceDonut({ completed, missed, remaining }: AdherenceDonutProps) {
  const total = completed + missed + remaining;

  if (total === 0) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
        <h3 className="text-sm font-semibold text-foreground font-raleway mb-2">Workout adherence</h3>
        <p className="text-sm text-foreground/50 font-merriweather-sans">
          Generate a plan to start tracking adherence.
        </p>
      </div>
    );
  }

  const data = [
    { key: "completed", label: "Completed", value: completed, color: CHART_STATUS.done },
    { key: "missed", label: "Missed", value: missed, color: CHART_STATUS.missed },
    { key: "remaining", label: "Upcoming", value: remaining, color: CHART_STATUS.neutral },
  ].filter((d) => d.value > 0);

  const pct = Math.round((completed / total) * 100);

  return (
    <div className={`bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 ${CHART_COLOR_SCHEME_CLASS}`}>
      <h3 className="text-sm font-semibold text-foreground font-raleway mb-4">Workout adherence</h3>

      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="95%" paddingAngle={3} stroke="none">
              {data.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              formatter={(value: number, name: string) => [`${value} workout${value === 1 ? "" : "s"}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-foreground font-raleway tabular-nums">{pct}%</span>
          <span className="text-[10px] text-foreground/40 font-merriweather-sans uppercase tracking-wider">
            done
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-2 flex-wrap">
        {data.map((slice) => (
          <span key={slice.key} className="flex items-center gap-1.5 text-xs font-merriweather-sans text-foreground/60">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: slice.color }} />
            {slice.label} {slice.value}
          </span>
        ))}
      </div>
    </div>
  );
}
