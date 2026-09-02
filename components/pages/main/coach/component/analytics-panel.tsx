"use client";

import { Activity, CalendarClock, Flame, Info, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { AnalyticsSummary, CompositionChange } from "@/lib/coach/analytics";

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  /** Renders the "Estimate" chip and explanation footnote. */
  estimate?: CompositionChange;
}

function StatTile({ icon, label, value, sub, estimate }: StatTileProps) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-raleway">
          {label}
        </p>
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-xl font-bold text-foreground font-raleway">{value}</p>
        {estimate && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold font-raleway ${
              estimate.basis === "measured"
                ? "bg-[var(--brand)]/15 text-[var(--brand-hover)]"
                : "bg-foreground/5 dark:bg-white/10 text-foreground/50"
            }`}
          >
            {estimate.basis === "measured" ? "Measured" : "Estimate"}
          </span>
        )}
      </div>

      {sub && (
        <p className="text-xs text-foreground/50 font-merriweather-sans">{sub}</p>
      )}
      {estimate && (
        <p className="text-[11px] leading-snug text-foreground/40 font-merriweather-sans">
          {estimate.explanation}
        </p>
      )}
    </div>
  );
}

function signed(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function dayLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

interface AnalyticsPanelProps {
  summary: AnalyticsSummary;
}

export default function AnalyticsPanel({ summary }: AnalyticsPanelProps) {
  const hasAnyActivity = summary.daysSinceLastActivity !== null;

  if (!hasAnyActivity) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 text-center">
        <Activity className="w-6 h-6 text-[var(--brand-hover)] mx-auto mb-2" />
        <p className="text-sm text-foreground/60 font-merriweather-sans">
          Log a workout or a meal and your stats will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={<Flame className="w-3.5 h-3.5 text-[var(--brand-hover)]" />}
          label="Current streak"
          value={`${summary.currentStreakDays} day${summary.currentStreakDays === 1 ? "" : "s"}`}
          sub={summary.longestStreakDays > 0 ? `Best: ${summary.longestStreakDays} days` : undefined}
        />

        <StatTile
          icon={<CalendarClock className="w-3.5 h-3.5 text-[var(--brand-hover)]" />}
          label="Last workout"
          value={summary.daysSinceLastWorkout === null ? "None yet" : dayLabel(summary.daysSinceLastWorkout)}
          sub={
            summary.daysSinceLastWorkout === null
              ? "Mark one done in your planner"
              : `${summary.workoutsCompleted} completed`
          }
        />

        <StatTile
          icon={<Target className="w-3.5 h-3.5 text-[var(--brand-hover)]" />}
          label="Plan adherence"
          value={summary.adherencePct === null ? "—" : `${summary.adherencePct}%`}
          sub={summary.adherencePct === null ? "No active plan" : "Of scheduled workouts"}
        />

        <StatTile
          icon={
            summary.weightChangeKg !== null && summary.weightChangeKg < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-[var(--brand-hover)]" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-[var(--brand-hover)]" />
            )
          }
          label="Weight change"
          value={
            summary.weightChangeKg === null
              ? "—"
              : `${summary.weightChangeKg > 0 ? "+" : ""}${summary.weightChangeKg}kg`
          }
          sub={summary.weightChangeKg === null ? "Log two weigh-ins" : "Since your first weigh-in"}
        />
      </div>

      {(summary.muscleGain || summary.fatChange) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {summary.muscleGain && (
            <StatTile
              icon={<Activity className="w-3.5 h-3.5 text-[var(--brand-hover)]" />}
              label="Lean mass change"
              value={signed(summary.muscleGain.pct)}
              estimate={summary.muscleGain}
            />
          )}
          {summary.fatChange && (
            <StatTile
              icon={<Activity className="w-3.5 h-3.5 text-[var(--brand-hover)]" />}
              label="Body fat change"
              value={signed(summary.fatChange.pct)}
              estimate={summary.fatChange}
            />
          )}
        </div>
      )}

      {(summary.muscleGain?.basis === "estimated" || summary.fatChange?.basis === "estimated") && (
        <div className="flex gap-2.5 px-4 py-3 rounded-xl bg-foreground/[0.03] dark:bg-white/5">
          <Info className="w-4 h-4 text-foreground/40 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-foreground/50 font-merriweather-sans">
            Body composition figures are modelled from your weight trend and training adherence — this app
            cannot measure body fat directly. Add a body fat % when you log a weigh-in and these become
            measured values.
          </p>
        </div>
      )}
    </div>
  );
}
