/**
 * Training analytics: activity recency, streaks, adherence, and body-composition
 * change.
 *
 * A deliberate line runs through this file. Recency, streak and adherence are
 * *measured* — they count rows the user actually created. Muscle-gain and
 * fat-loss percentages are *modelled*: this app has no way to measure body
 * composition, so unless the user supplies a real body-fat reading we can only
 * infer a direction from weight trend, goal and training adherence.
 *
 * Every modelled figure is returned with `basis: "measured" | "estimated"` so
 * the UI can never accidentally present a guess as a measurement. Do not strip
 * that field — it is the whole reason the estimates are safe to display.
 *
 * Pure functions: no DB, no network, no clock reads except an injectable `now`.
 */

export type ActivityKind = "workout" | "food" | "weight";

export interface ActivityEvent {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  kind: ActivityKind;
}

export interface WeightPoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  weightKg: number;
  /** Real measurement when the user has a scale that reports it. Usually absent. */
  bodyFatPct?: number | null;
}

/** How a number was arrived at. Drives the UI's "Estimate" labelling. */
export type Basis = "measured" | "estimated";

export interface CompositionChange {
  /** Signed percentage-point change over the window. Positive = increase. */
  pct: number;
  basis: Basis;
  /** Plain-language account of how this number was produced. */
  explanation: string;
}

export interface AnalyticsSummary {
  daysSinceLastWorkout: number | null;
  daysSinceLastActivity: number | null;
  currentStreakDays: number;
  longestStreakDays: number;
  workoutsCompleted: number;
  /** Completed ÷ scheduled over the window, 0-100. Null when nothing scheduled. */
  adherencePct: number | null;
  weightChangeKg: number | null;
  muscleGain: CompositionChange | null;
  fatChange: CompositionChange | null;
}

const MS_PER_DAY = 86_400_000;

function toUtcDay(iso: string): number {
  // Parse as a plain calendar date. Using Date.parse on "YYYY-MM-DD" yields
  // UTC midnight, so day arithmetic stays free of timezone drift.
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function todayUtcDay(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / MS_PER_DAY;
}

/** Whole days between an ISO date and today. Negative dates (future) clamp to 0. */
export function daysSince(iso: string, now = new Date()): number {
  return Math.max(0, todayUtcDay(now) - toUtcDay(iso));
}

/**
 * Consecutive days ending today or yesterday that have at least one event.
 *
 * Yesterday counts as still-alive so a user who hasn't logged yet today does
 * not watch their streak read zero all morning — it breaks only once a full
 * day has been missed.
 */
export function currentStreak(events: ActivityEvent[], now = new Date()): number {
  if (events.length === 0) return 0;

  const days = new Set(events.map((e) => toUtcDay(e.date)));
  const today = todayUtcDay(now);

  let cursor = days.has(today) ? today : today - 1;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

/** Longest run of consecutive active days anywhere in the history. */
export function longestStreak(events: ActivityEvent[]): number {
  if (events.length === 0) return 0;

  const days = [...new Set(events.map((e) => toUtcDay(e.date)))].sort((a, b) => a - b);

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Completed ÷ scheduled, clamped to 0-100. Null when nothing was scheduled. */
export function adherenceRate(completed: number, scheduled: number): number | null {
  if (scheduled <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (completed / scheduled) * 100)));
}

function sortByDate<T extends { date: string }>(points: T[]): T[] {
  return [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Signed weight delta between the first and last weigh-in. */
export function weightChangeKg(history: WeightPoint[]): number | null {
  if (history.length < 2) return null;
  const sorted = sortByDate(history);
  return round1(sorted[sorted.length - 1].weightKg - sorted[0].weightKg);
}

/**
 * Fat and lean-mass change across the weigh-in window.
 *
 * Two paths, and the difference is reported honestly via `basis`:
 *
 * - measured — the user logged a real body-fat % at both ends. Fat mass and
 *   lean mass are computed directly from weight × body-fat, so these are
 *   arithmetic on real readings.
 *
 * - estimated — no body-fat readings, so we apply a coarse partitioning
 *   heuristic: how a weight change splits between fat and lean tissue depends
 *   on training stimulus. A well-adhered resistance plan in a deficit spares
 *   lean mass and can add a little; no training means a change is mostly fat
 *   with some lean loss. The split ratios below are rough population-level
 *   rules of thumb, NOT measurements of this user, and the returned
 *   explanation says so.
 *
 * Returns null when there is too little data to say anything at all — showing
 * "0%" from a single weigh-in would imply a finding we do not have.
 */
export function compositionChange(
  history: WeightPoint[],
  opts: { adherencePct: number | null; goal: string }
): { muscle: CompositionChange; fat: CompositionChange } | null {
  if (history.length < 2) return null;

  const sorted = sortByDate(history);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Measured path: real readings at both ends.
  if (first.bodyFatPct != null && last.bodyFatPct != null) {
    const firstFat = (first.weightKg * first.bodyFatPct) / 100;
    const lastFat = (last.weightKg * last.bodyFatPct) / 100;
    const firstLean = first.weightKg - firstFat;
    const lastLean = last.weightKg - lastFat;

    return {
      muscle: {
        pct: round1(pctChange(firstLean, lastLean)),
        basis: "measured",
        explanation: "Calculated from the body-fat readings you logged at each weigh-in.",
      },
      fat: {
        pct: round1(pctChange(firstFat, lastFat)),
        basis: "measured",
        explanation: "Calculated from the body-fat readings you logged at each weigh-in.",
      },
    };
  }

  // Estimated path: infer a split from weight movement + training adherence.
  const deltaKg = last.weightKg - first.weightKg;
  if (Math.abs(deltaKg) < 0.1) {
    return {
      muscle: {
        pct: 0,
        basis: "estimated",
        explanation:
          "Your weight is essentially unchanged, so there is nothing to attribute yet. Log a body-fat % at weigh-in for a measured figure.",
      },
      fat: {
        pct: 0,
        basis: "estimated",
        explanation:
          "Your weight is essentially unchanged, so there is nothing to attribute yet. Log a body-fat % at weigh-in for a measured figure.",
      },
    };
  }

  // Training stimulus drives how a weight change partitions. Adherence is the
  // best proxy this app has for stimulus; absent adherence data, assume little.
  const adherence = opts.adherencePct ?? 0;
  const stimulus = Math.min(1, Math.max(0, adherence / 100));

  const losing = deltaKg < 0;
  let leanDelta: number;

  if (losing) {
    // Losing: training spares lean tissue. Untrained, roughly a quarter of the
    // loss comes off lean mass; with full adherence lean mass is preserved and
    // may even tick up slightly as training drives adaptation.
    const leanLossShare = 0.25 * (1 - stimulus);
    leanDelta = deltaKg * leanLossShare + 0.05 * stimulus * Math.abs(deltaKg);
  } else {
    // Gaining: training determines how much of the surplus becomes lean tissue.
    // Untrained gain is overwhelmingly fat; well-trained gain partitions better.
    const leanGainShare = 0.1 + 0.4 * stimulus;
    leanDelta = deltaKg * leanGainShare;
  }

  const fatDelta = deltaKg - leanDelta;

  const startFatKg = first.weightKg * 0.25; // Coarse population stand-in.
  const startLeanKg = first.weightKg - startFatKg;

  const explanation =
    `Modelled from your ${fmtKg(deltaKg)} weight change and ${adherence}% plan adherence — ` +
    `not a body measurement. Log a body-fat % at weigh-in for a measured figure.`;

  return {
    muscle: {
      pct: round1((leanDelta / startLeanKg) * 100),
      basis: "estimated",
      explanation,
    },
    fat: {
      pct: round1((fatDelta / startFatKg) * 100),
      basis: "estimated",
      explanation,
    },
  };
}

/** Assembles the full dashboard summary from raw logs. */
export function buildAnalytics(
  input: {
    workoutDates: string[];
    foodDates: string[];
    weightHistory: WeightPoint[];
    scheduledWorkouts: number;
    goal: string;
  },
  now = new Date()
): AnalyticsSummary {
  const events: ActivityEvent[] = [
    ...input.workoutDates.map((date) => ({ date, kind: "workout" as const })),
    ...input.foodDates.map((date) => ({ date, kind: "food" as const })),
    ...input.weightHistory.map((w) => ({ date: w.date, kind: "weight" as const })),
  ];

  const lastWorkout = maxDate(input.workoutDates);
  const lastAny = maxDate(events.map((e) => e.date));

  const adherencePct = adherenceRate(input.workoutDates.length, input.scheduledWorkouts);
  const composition = compositionChange(input.weightHistory, { adherencePct, goal: input.goal });

  return {
    daysSinceLastWorkout: lastWorkout ? daysSince(lastWorkout, now) : null,
    daysSinceLastActivity: lastAny ? daysSince(lastAny, now) : null,
    currentStreakDays: currentStreak(events, now),
    longestStreakDays: longestStreak(events),
    workoutsCompleted: input.workoutDates.length,
    adherencePct,
    weightChangeKg: weightChangeKg(input.weightHistory),
    muscleGain: composition?.muscle ?? null,
    fatChange: composition?.fat ?? null,
  };
}

function maxDate(dates: string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (a > b ? a : b));
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

function fmtKg(kg: number): string {
  const abs = Math.abs(kg).toFixed(1);
  return kg < 0 ? `${abs}kg loss` : `${abs}kg gain`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
