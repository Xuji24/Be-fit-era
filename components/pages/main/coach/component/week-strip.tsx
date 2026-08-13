"use client";

/**
 * Seven cells showing the shape of the visible week: which days train, which
 * rest, and what's already done.
 *
 * The day cards answer "what am I doing on Wednesday". This answers "how is
 * this week laid out" — the question behind "why is there a 7 day split",
 * which the grid of cards never actually addressed because a rest day and a
 * not-yet-started training day looked identical from the outside.
 */

export interface WeekStripDay {
  dayIndex: number;
  /** Single letter for the cell, e.g. "M". */
  initial: string;
  /** Full weekday name, for the accessible label. */
  weekday: string;
  workoutCount: number;
  workoutsDone: number;
  hasMeals: boolean;
  isToday: boolean;
}

interface WeekStripProps {
  days: WeekStripDay[];
}

function describe(day: WeekStripDay): string {
  if (day.workoutCount === 0) return day.hasMeals ? "rest day" : "nothing scheduled";
  if (day.workoutsDone === day.workoutCount) return "training day, complete";
  return `training day, ${day.workoutsDone} of ${day.workoutCount} done`;
}

export default function WeekStrip({ days }: WeekStripProps) {
  return (
    <div className="flex gap-1.5" role="list" aria-label="This week at a glance">
      {days.map((day) => {
        const isRest = day.workoutCount === 0 && day.hasMeals;
        const isEmpty = day.workoutCount === 0 && !day.hasMeals;
        const allDone = day.workoutCount > 0 && day.workoutsDone === day.workoutCount;

        const bar = allDone
          ? "bg-emerald-500"
          : isRest
            ? "bg-[#1A1A1A]/15 dark:bg-white/15"
            : isEmpty
              ? "bg-[#1A1A1A]/8 dark:bg-white/8"
              : "bg-[#FF5733]";

        return (
          <div
            key={day.dayIndex}
            role="listitem"
            aria-label={`${day.weekday}: ${describe(day)}`}
            className="flex-1 min-w-0 flex flex-col items-center gap-1.5"
          >
            <span
              className={`text-[10px] font-semibold font-raleway uppercase tracking-wider ${
                day.isToday ? "text-[#FF5733]" : "text-[#1A1A1A]/35 dark:text-white/35"
              }`}
            >
              {day.initial}
            </span>
            {/* Height encodes training vs rest so the week's rhythm is legible
                without reading any text — a rest day is a shorter, quieter mark. */}
            <span
              aria-hidden="true"
              className={`w-full rounded-full transition-colors ${bar} ${isRest || isEmpty ? "h-1" : "h-2"}`}
            />
          </div>
        );
      })}
    </div>
  );
}
