"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { macroEnergySplit, type MacroTotals } from "@/lib/coach/weekly";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_ITEM_STYLE, CHART_COLOR_SCHEME_CLASS } from "@/lib/charts/theme";

interface MacroSplitDonutProps {
  totals: MacroTotals;
}

const SLICES = [
  { key: "protein" as const, label: "Protein", color: "#FF5733" },
  { key: "carbs" as const, label: "Carbs", color: "#3B82F6" },
  { key: "fat" as const, label: "Fat", color: "#FFB800" },
];

/**
 * Where this week's calories came from, by macro — the natural pie chart for
 * this data. Split by energy (kcal), not by grams: fat carries roughly double
 * the calories per gram of protein or carbs, so a gram-based split understates
 * it. See macroEnergySplit() for the actual math.
 */
export default function MacroSplitDonut({ totals }: MacroSplitDonutProps) {
  const split = macroEnergySplit(totals);

  if (!split) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
        <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway mb-2">This week&apos;s macro split</h3>
        <p className="text-sm text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans">
          Log some food this week to see where your calories are coming from.
        </p>
      </div>
    );
  }

  const data = SLICES.map((s) => ({ ...s, value: split[s.key] }));
  const totalKcal = totals.proteinG * 4 + totals.carbsG * 4 + totals.fatG * 9;

  return (
    <div className={`bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 ${CHART_COLOR_SCHEME_CLASS}`}>
      <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway mb-4">This week&apos;s macro split</h3>

      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="95%"
              paddingAngle={3}
              stroke="none"
            >
              {data.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label is absolutely-positioned HTML, not SVG text — the
            established pattern in this codebase (race-progress-overview.tsx). */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-[#1A1A1A] dark:text-white font-raleway tabular-nums">
            {Math.round(totalKcal)}
          </span>
          <span className="text-[10px] text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans uppercase tracking-wider">
            kcal
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-2">
        {data.map((slice) => (
          <span key={slice.key} className="flex items-center gap-1.5 text-xs font-merriweather-sans text-[#1A1A1A]/60 dark:text-white/60">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: slice.color }} />
            {slice.label} {slice.value}%
          </span>
        ))}
      </div>
    </div>
  );
}
