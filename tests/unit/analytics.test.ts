import { describe, it, expect } from "vitest";
import {
  daysSince,
  currentStreak,
  longestStreak,
  adherenceRate,
  weightChangeKg,
  compositionChange,
  buildAnalytics,
  type ActivityEvent,
  type WeightPoint,
} from "@/lib/coach/analytics";

// Fixed clock so day-arithmetic expectations never drift as real time passes.
const NOW = new Date("2026-08-07T12:00:00Z");

const ev = (date: string): ActivityEvent => ({ date, kind: "workout" });

describe("daysSince", () => {
  it("returns 0 for today", () => {
    expect(daysSince("2026-08-07", NOW)).toBe(0);
  });

  it("counts whole calendar days", () => {
    expect(daysSince("2026-08-01", NOW)).toBe(6);
  });

  it("clamps future dates to 0 rather than going negative", () => {
    expect(daysSince("2026-09-01", NOW)).toBe(0);
  });

  it("is timezone-stable across a month boundary", () => {
    expect(daysSince("2026-07-31", NOW)).toBe(7);
  });
});

describe("currentStreak", () => {
  it("is 0 with no events", () => {
    expect(currentStreak([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(currentStreak([ev("2026-08-05"), ev("2026-08-06"), ev("2026-08-07")], NOW)).toBe(3);
  });

  it("keeps the streak alive when the user hasn't logged yet today", () => {
    // Ending yesterday still counts — a streak breaks after a full missed day.
    expect(currentStreak([ev("2026-08-05"), ev("2026-08-06")], NOW)).toBe(2);
  });

  it("breaks once a full day is missed", () => {
    expect(currentStreak([ev("2026-08-03"), ev("2026-08-04")], NOW)).toBe(0);
  });

  it("counts a day once even with several events on it", () => {
    expect(currentStreak([ev("2026-08-07"), ev("2026-08-07"), ev("2026-08-06")], NOW)).toBe(2);
  });
});

describe("longestStreak", () => {
  it("is 0 with no events", () => {
    expect(longestStreak([])).toBe(0);
  });

  it("finds the longest historical run, not the current one", () => {
    const events = [
      ev("2026-07-01"), ev("2026-07-02"), ev("2026-07-03"), ev("2026-07-04"),
      ev("2026-08-06"), ev("2026-08-07"),
    ];
    expect(longestStreak(events)).toBe(4);
  });
});

describe("adherenceRate", () => {
  it("returns null when nothing was scheduled", () => {
    expect(adherenceRate(0, 0)).toBeNull();
  });

  it("computes a percentage", () => {
    expect(adherenceRate(3, 4)).toBe(75);
  });

  it("clamps above 100 when the user over-delivers", () => {
    expect(adherenceRate(9, 4)).toBe(100);
  });
});

describe("weightChangeKg", () => {
  it("returns null with fewer than two weigh-ins", () => {
    expect(weightChangeKg([{ date: "2026-08-01", weightKg: 80 }])).toBeNull();
  });

  it("is signed, first to last, regardless of input order", () => {
    const history: WeightPoint[] = [
      { date: "2026-08-07", weightKg: 78 },
      { date: "2026-08-01", weightKg: 80 },
    ];
    expect(weightChangeKg(history)).toBe(-2);
  });
});

describe("compositionChange", () => {
  it("returns null with fewer than two weigh-ins", () => {
    const result = compositionChange([{ date: "2026-08-01", weightKg: 80 }], {
      adherencePct: 80,
      goal: "lose_fat",
    });
    expect(result).toBeNull();
  });

  it("marks results measured when real body-fat readings exist at both ends", () => {
    const history: WeightPoint[] = [
      { date: "2026-08-01", weightKg: 80, bodyFatPct: 25 },
      { date: "2026-08-07", weightKg: 78, bodyFatPct: 23 },
    ];
    const result = compositionChange(history, { adherencePct: 80, goal: "lose_fat" })!;

    expect(result.fat.basis).toBe("measured");
    expect(result.muscle.basis).toBe("measured");
    // Fat mass 20kg -> 17.94kg is a real decrease.
    expect(result.fat.pct).toBeLessThan(0);
    // Lean mass 60kg -> 60.06kg holds roughly steady.
    expect(result.muscle.pct).toBeGreaterThanOrEqual(0);
  });

  it("marks results estimated when no body-fat readings exist", () => {
    const history: WeightPoint[] = [
      { date: "2026-08-01", weightKg: 80 },
      { date: "2026-08-07", weightKg: 78 },
    ];
    const result = compositionChange(history, { adherencePct: 80, goal: "lose_fat" })!;

    expect(result.fat.basis).toBe("estimated");
    expect(result.muscle.basis).toBe("estimated");
    // The explanation must disclose that this is modelled, so the UI can never
    // present it as a measurement.
    expect(result.fat.explanation).toMatch(/not a body measurement/i);
  });

  it("attributes weight loss mostly to fat when adherence is high", () => {
    const history: WeightPoint[] = [
      { date: "2026-08-01", weightKg: 80 },
      { date: "2026-08-07", weightKg: 78 },
    ];
    const high = compositionChange(history, { adherencePct: 100, goal: "lose_fat" })!;
    const low = compositionChange(history, { adherencePct: 0, goal: "lose_fat" })!;

    // With full adherence lean mass is spared, so lean change is less negative
    // (in fact slightly positive) than when untrained.
    expect(high.muscle.pct).toBeGreaterThan(low.muscle.pct);
  });

  it("reports zero with a disclosure when weight is unchanged", () => {
    const history: WeightPoint[] = [
      { date: "2026-08-01", weightKg: 80 },
      { date: "2026-08-07", weightKg: 80 },
    ];
    const result = compositionChange(history, { adherencePct: 50, goal: "maintain" })!;

    expect(result.fat.pct).toBe(0);
    expect(result.muscle.pct).toBe(0);
    expect(result.fat.basis).toBe("estimated");
  });
});

describe("buildAnalytics", () => {
  it("summarises an active user", () => {
    const summary = buildAnalytics(
      {
        workoutDates: ["2026-08-05", "2026-08-06", "2026-08-07"],
        foodDates: ["2026-08-07"],
        weightHistory: [
          { date: "2026-08-01", weightKg: 80 },
          { date: "2026-08-07", weightKg: 78.5 },
        ],
        scheduledWorkouts: 4,
        goal: "lose_fat",
      },
      NOW
    );

    expect(summary.daysSinceLastWorkout).toBe(0);
    expect(summary.currentStreakDays).toBe(3);
    expect(summary.workoutsCompleted).toBe(3);
    expect(summary.adherencePct).toBe(75);
    expect(summary.weightChangeKg).toBe(-1.5);
    expect(summary.muscleGain?.basis).toBe("estimated");
  });

  it("returns nulls rather than zeros for a user with no history", () => {
    const summary = buildAnalytics(
      { workoutDates: [], foodDates: [], weightHistory: [], scheduledWorkouts: 0, goal: "maintain" },
      NOW
    );

    // Null, not 0 — "no data" and "zero days ago" are different claims.
    expect(summary.daysSinceLastWorkout).toBeNull();
    expect(summary.adherencePct).toBeNull();
    expect(summary.muscleGain).toBeNull();
    expect(summary.currentStreakDays).toBe(0);
  });

  it("treats food and weight logs as activity for streak purposes", () => {
    const summary = buildAnalytics(
      {
        workoutDates: [],
        foodDates: ["2026-08-06", "2026-08-07"],
        weightHistory: [{ date: "2026-08-05", weightKg: 80 }],
        scheduledWorkouts: 3,
        goal: "maintain",
      },
      NOW
    );

    expect(summary.currentStreakDays).toBe(3);
    // But a workout-specific metric stays null: no workouts were logged.
    expect(summary.daysSinceLastWorkout).toBeNull();
    expect(summary.daysSinceLastActivity).toBe(0);
  });
});
