"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { WeeklyActivityPoint } from "@/lib/coach/weekly";
import {
  CHART_BRAND,
  CHART_GRID_STROKE,
  CHART_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_COLOR_SCHEME_CLASS,
} from "@/lib/charts/theme";

interface WeeklyActivityChartProps {
  weeks: WeeklyActivityPoint[];
}

/**
 * Days logged and training minutes per week — the consistency view. A silent
 * week shows as a bar at zero, not as a gap, so it reads as "you didn't train"
 * rather than as missing data (see toWeeklyActivity in lib/coach/weekly.ts).
 */
export default function WeeklyActivityChart({ weeks }: WeeklyActivityChartProps) {
  const hasAnyActivity = weeks.some((w) => w.daysLogged > 0 || w.trainingMinutes > 0);

  return (
    <div className={`bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 ${CHART_COLOR_SCHEME_CLASS}`}>
      <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway mb-4">Weekly consistency</h3>

      {!hasAnyActivity ? (
        <p className="text-sm text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans text-center py-10">
          Log a meal or a workout to start building this view.
        </p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                formatter={(value: number, name: string) => [
                  name === "daysLogged" ? `${value}/7 days` : `${value} min`,
                  name === "daysLogged" ? "Logged" : "Training time",
                ]}
              />
              <Bar dataKey="daysLogged" fill={CHART_BRAND} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
