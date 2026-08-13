"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { bmiCategory } from "@/lib/coach/nutrition";
import type { WeeklyWeightPoint } from "@/lib/coach/weekly";
import {
  CHART_BRAND,
  CHART_GRID_STROKE,
  CHART_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_COLOR_SCHEME_CLASS,
} from "@/lib/charts/theme";

interface BmiTrendChartProps {
  weeks: WeeklyWeightPoint[];
}

export default function BmiTrendChart({ weeks }: BmiTrendChartProps) {
  if (weeks.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
        <p className="text-sm text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans">
          Log this week&apos;s weigh-in to start tracking your BMI over time.
        </p>
      </div>
    );
  }

  const latest = weeks[weeks.length - 1];
  const chartData = weeks.map((w) => ({ label: w.label, bmi: w.bmi, weightKg: w.weightKg }));

  return (
    <div className={`bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 ${CHART_COLOR_SCHEME_CLASS}`}>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">Weekly BMI trend</h3>
        {latest.bmi !== null && (
          <p className="text-sm font-semibold text-[#FF5733] font-raleway capitalize">
            {latest.bmi} · {bmiCategory(latest.bmi)}
          </p>
        )}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={30} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              labelStyle={CHART_TOOLTIP_ITEM_STYLE}
              formatter={(value: number, name: string) => [name === "bmi" ? value : `${value} kg`, name === "bmi" ? "BMI" : "Weight"]}
            />
            <Line type="monotone" dataKey="bmi" stroke={CHART_BRAND} strokeWidth={2.5} dot={{ r: 3, fill: CHART_BRAND }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
