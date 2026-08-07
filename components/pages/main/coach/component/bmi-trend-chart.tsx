"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { bmiCategory } from "@/lib/coach/nutrition";
import type { WeightLogRow } from "@/app/actions/coach-weight-actions";

interface BmiTrendChartProps {
  history: WeightLogRow[];
}

export default function BmiTrendChart({ history }: BmiTrendChartProps) {
  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
        <p className="text-sm text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans">
          Log a weigh-in to start tracking your BMI over time.
        </p>
      </div>
    );
  }

  const latest = history[history.length - 1];
  const chartData = history.map((h) => ({
    date: new Date(h.loggedOn).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    bmi: h.bmi,
    weightKg: h.weightKg,
  }));

  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">BMI trend</h3>
        <p className="text-sm font-semibold text-[#FF5733] font-raleway capitalize">
          {latest.bmi} · {bmiCategory(latest.bmi)}
        </p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(128,128,128,0.6)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(128,128,128,0.6)" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "none", fontSize: 12, fontFamily: "var(--font-merriweather-sans)" }}
              formatter={(value: number, name: string) => [name === "bmi" ? value : `${value} kg`, name === "bmi" ? "BMI" : "Weight"]}
            />
            <Line type="monotone" dataKey="bmi" stroke="#FF5733" strokeWidth={2.5} dot={{ r: 3, fill: "#FF5733" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
