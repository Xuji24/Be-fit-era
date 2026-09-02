"use client";

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { WeeklyStat, JoinedRace } from "@/data/activities-data";

interface Props {
  joinedRaces: JoinedRace[];
  weeklyData: WeeklyStat[];
}

const RaceProgressOverview = ({ joinedRaces, weeklyData }: Props) => {
  // Pick the first in-progress race as the featured one
  const featured = joinedRaces.find((r) => r.status === "in-progress");
  if (!featured) return null;

  const progress = Math.min(
    (featured.loggedDistance / featured.targetDistance) * 100,
    100,
  );
  const remaining =
    Math.round((featured.targetDistance - featured.loggedDistance) * 10) / 10;

  // Average daily km from weekly data
  const activeDays = weeklyData.filter((d) => d.distance > 0).length;
  const totalWeekly = weeklyData.reduce((s, d) => s + d.distance, 0);
  const avgPerDay = activeDays > 0 ? totalWeekly / activeDays : 0;
  const daysToFinish =
    avgPerDay > 0 ? Math.ceil(remaining / avgPerDay) : Infinity;

  // Milestone label
  let milestone = "";
  if (progress >= 100) milestone = "Race Complete!";
  else if (progress >= 75) milestone = "Almost there!";
  else if (progress >= 50) milestone = "Halfway!";
  else if (progress >= 25) milestone = "Quarter done!";
  else milestone = "Just getting started";

  // Recharts fill needs a literal color, not a CSS var() — kept in sync
  // with --brand in app/globals.css by hand.
  const chartData = [{ value: progress, fill: "#FFB366" }];

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-bold text-foreground font-raleway">
          Race Progress
        </h2>
        <p className="text-xs text-foreground/40 mt-0.5">
          {featured.title}
        </p>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-6 border border-black/5 dark:border-white/5">
      {/* Radial progress ring */}
      <div className="flex flex-col items-center">
        <div className="w-44 h-44 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="78%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              data={chartData}
              barSize={12}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background={{ fill: "rgba(128,128,128,0.1)" }}
                dataKey="value"
                angleAxisId={0}
                cornerRadius={6}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[var(--brand-hover)] font-raleway">
              {Math.round(progress)}%
            </span>
            <span className="text-[10px] text-foreground/40 uppercase tracking-wider">
              complete
            </span>
          </div>
        </div>

        {/* Milestone badge */}
        <div className="mt-3 px-3 py-1 rounded-full bg-[var(--brand)]/12 text-[var(--brand-hover)] text-xs font-semibold">
          {milestone}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="bg-[var(--surface-muted)] dark:bg-[#2A2A2E] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-foreground">
            {featured.loggedDistance} km
          </p>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider">
            Logged
          </p>
        </div>
        <div className="bg-[var(--surface-muted)] dark:bg-[#2A2A2E] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-foreground">
            {remaining > 0 ? `${remaining} km` : "Done!"}
          </p>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider">
            Remaining
          </p>
        </div>
        <div className="bg-[var(--surface-muted)] dark:bg-[#2A2A2E] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-foreground">
            {avgPerDay.toFixed(1)} km
          </p>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider">
            Avg / Day
          </p>
        </div>
        <div className="bg-[var(--surface-muted)] dark:bg-[#2A2A2E] rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-foreground">
            {daysToFinish === Infinity ? "—" : `~${daysToFinish}d`}
          </p>
          <p className="text-[10px] text-foreground/40 uppercase tracking-wider">
            Est. Finish
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default RaceProgressOverview;
