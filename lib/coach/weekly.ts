/**
 * Weekly bucketing for the progress page.
 *
 * Weight is tracked per week rather than per day: day-to-day weight is mostly
 * water, food volume, and time of day, so a daily chart shows noise and invites
 * people to react to it. A weekly figure is the smallest window where the trend
 * is the signal.
 *
 * There is no migration behind this. `coach_weight_logs` has
 * `UNIQUE (user_id, logged_on)`, so writing the week's Monday into `logged_on`
 * makes that constraint enforce one weigh-in per week for free. Rows already
 * stored per-day still read correctly because everything here buckets on read.
 *
 * Weeks start Monday and are computed in UTC, matching periodKey() in
 * lib/coach/tiers.ts — a local week boundary would need a per-user timezone the
 * server doesn't reliably have.
 */

const MS_PER_DAY = 86_400_000;

/** The Monday of the week containing `date`, as a YYYY-MM-DD key. */
export function weekStartKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // getUTCDay: Sunday = 0. Shift so Monday = 0 and Sunday = 6.
  const offset = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc.toISOString().slice(0, 10);
}

/** Same, from a YYYY-MM-DD string. */
export function weekStartKeyOf(isoDate: string): string {
  return weekStartKey(new Date(`${isoDate}T00:00:00Z`));
}

/** "Aug 4" — a short label for a week bucket. */
export function formatWeekLabel(weekKey: string): string {
  return new Date(`${weekKey}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Whole weeks between two week keys. Negative when `a` is later than `b`. */
export function weeksBetween(a: string, b: string): number {
  const diff = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(diff / (MS_PER_DAY * 7));
}

export interface DatedWeight {
  date: string;
  weightKg: number;
  bodyFatPct?: number | null;
  bmi?: number | null;
}

export interface WeeklyWeightPoint {
  /** Monday of the bucket, YYYY-MM-DD. */
  weekKey: string;
  label: string;
  /** Mean of every weigh-in that landed in the week. */
  weightKg: number;
  bodyFatPct: number | null;
  bmi: number | null;
  /** How many raw entries were averaged — legacy daily rows can be >1. */
  entryCount: number;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Collapses raw weigh-ins into one point per week, oldest first. Averaging
 * rather than last-write-wins is what makes legacy daily data useful instead of
 * arbitrary — with one entry per week it's a no-op.
 */
export function toWeeklyWeights(history: DatedWeight[]): WeeklyWeightPoint[] {
  const buckets = new Map<string, DatedWeight[]>();
  for (const entry of history) {
    const key = weekStartKeyOf(entry.date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([weekKey, entries]) => {
      const fats = entries.map((e) => e.bodyFatPct).filter((v): v is number => typeof v === "number");
      const bmis = entries.map((e) => e.bmi).filter((v): v is number => typeof v === "number");
      return {
        weekKey,
        label: formatWeekLabel(weekKey),
        weightKg: round1(mean(entries.map((e) => e.weightKg))),
        bodyFatPct: fats.length > 0 ? round1(mean(fats)) : null,
        bmi: bmis.length > 0 ? round1(mean(bmis)) : null,
        entryCount: entries.length,
      };
    });
}

export interface WeeklyActivityPoint {
  weekKey: string;
  label: string;
  /** Distinct days with any food or workout log. 0-7. */
  daysLogged: number;
  workouts: number;
  trainingMinutes: number;
}

export interface ActivityInput {
  foodDates: string[];
  workoutDates: string[];
  /** Optional per-workout durations, aligned by index with workoutDates. */
  workoutMinutes?: (number | null)[];
}

/**
 * Per-week activity totals for the last `weeks` weeks, oldest first. Weeks with
 * no activity are included as zeroes — a gap in a bar chart should read as "you
 * didn't train", not as missing data.
 */
export function toWeeklyActivity(
  input: ActivityInput,
  weeks = 8,
  now: Date = new Date()
): WeeklyActivityPoint[] {
  const currentWeek = weekStartKey(now);

  const keys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${currentWeek}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    keys.push(d.toISOString().slice(0, 10));
  }

  const byWeek = new Map<string, { days: Set<string>; workouts: number; minutes: number }>(
    keys.map((k) => [k, { days: new Set<string>(), workouts: 0, minutes: 0 }])
  );

  for (const date of input.foodDates) {
    byWeek.get(weekStartKeyOf(date))?.days.add(date);
  }

  input.workoutDates.forEach((date, i) => {
    const bucket = byWeek.get(weekStartKeyOf(date));
    if (!bucket) return;
    bucket.days.add(date);
    bucket.workouts += 1;
    bucket.minutes += input.workoutMinutes?.[i] ?? 0;
  });

  return keys.map((weekKey) => {
    const bucket = byWeek.get(weekKey)!;
    return {
      weekKey,
      label: formatWeekLabel(weekKey),
      daysLogged: bucket.days.size,
      workouts: bucket.workouts,
      trainingMinutes: bucket.minutes,
    };
  });
}

export interface MacroTotals {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Energy contribution of each macro, as percentages summing to 100.
 *
 * Deliberately by calories, not by grams: protein and carbs carry ~4 kcal/g
 * while fat carries ~9, so a gram-based split makes fat look far smaller than
 * its actual share of intake. Returns null when nothing has been logged —
 * a pie chart of zeroes is worse than no chart.
 */
export function macroEnergySplit(
  totals: MacroTotals
): { protein: number; carbs: number; fat: number } | null {
  const proteinKcal = totals.proteinG * 4;
  const carbsKcal = totals.carbsG * 4;
  const fatKcal = totals.fatG * 9;
  const total = proteinKcal + carbsKcal + fatKcal;
  if (total <= 0) return null;

  const protein = Math.round((proteinKcal / total) * 100);
  const carbs = Math.round((carbsKcal / total) * 100);
  // Derive the last slice so rounding can never make the three miss 100.
  return { protein, carbs, fat: 100 - protein - carbs };
}
