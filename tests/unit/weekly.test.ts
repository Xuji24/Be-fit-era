import { describe, it, expect } from "vitest";
import {
  weekStartKey,
  weekStartKeyOf,
  formatWeekLabel,
  weeksBetween,
  toWeeklyWeights,
  toWeeklyActivity,
  macroEnergySplit,
} from "@/lib/coach/weekly";

// 2026-08-09 is a Sunday; its week starts Monday 2026-08-03.
const NOW = new Date("2026-08-09T12:00:00Z");

describe("weekStartKey", () => {
  it("returns the Monday of the containing week", () => {
    expect(weekStartKey(new Date("2026-08-03T00:00:00Z"))).toBe("2026-08-03"); // Mon
    expect(weekStartKey(new Date("2026-08-06T23:59:00Z"))).toBe("2026-08-03"); // Thu
    expect(weekStartKey(new Date("2026-08-09T12:00:00Z"))).toBe("2026-08-03"); // Sun
  });

  it("treats Sunday as the END of a week, not the start", () => {
    // The classic off-by-one here: getUTCDay() puts Sunday at 0, so a naive
    // implementation rolls Sunday forward into the next week.
    expect(weekStartKey(new Date("2026-08-09T00:00:00Z"))).toBe("2026-08-03");
    expect(weekStartKey(new Date("2026-08-10T00:00:00Z"))).toBe("2026-08-10");
  });

  it("crosses a month boundary correctly", () => {
    expect(weekStartKey(new Date("2026-09-02T00:00:00Z"))).toBe("2026-08-31");
  });

  it("reads a YYYY-MM-DD string the same way", () => {
    expect(weekStartKeyOf("2026-08-06")).toBe("2026-08-03");
  });
});

describe("formatWeekLabel / weeksBetween", () => {
  it("labels a week by its Monday", () => {
    expect(formatWeekLabel("2026-08-03")).toMatch(/Aug\s*3/);
  });

  it("counts whole weeks in both directions", () => {
    expect(weeksBetween("2026-08-03", "2026-08-31")).toBe(4);
    expect(weeksBetween("2026-08-31", "2026-08-03")).toBe(-4);
    expect(weeksBetween("2026-08-03", "2026-08-03")).toBe(0);
  });
});

describe("toWeeklyWeights", () => {
  it("collapses several weigh-ins in one week into their mean", () => {
    const points = toWeeklyWeights([
      { date: "2026-08-03", weightKg: 80 },
      { date: "2026-08-05", weightKg: 82 },
      { date: "2026-08-07", weightKg: 81 },
    ]);

    expect(points).toHaveLength(1);
    expect(points[0].weightKg).toBe(81);
    expect(points[0].entryCount).toBe(3);
  });

  it("is a no-op on already-weekly data", () => {
    const points = toWeeklyWeights([
      { date: "2026-08-03", weightKg: 80 },
      { date: "2026-08-10", weightKg: 79.4 },
    ]);
    expect(points.map((p) => p.weightKg)).toEqual([80, 79.4]);
    expect(points.every((p) => p.entryCount === 1)).toBe(true);
  });

  it("returns weeks oldest first regardless of input order", () => {
    const points = toWeeklyWeights([
      { date: "2026-08-17", weightKg: 78 },
      { date: "2026-08-03", weightKg: 80 },
      { date: "2026-08-10", weightKg: 79 },
    ]);
    expect(points.map((p) => p.weekKey)).toEqual(["2026-08-03", "2026-08-10", "2026-08-17"]);
  });

  it("averages body fat and BMI only over entries that have them", () => {
    const points = toWeeklyWeights([
      { date: "2026-08-03", weightKg: 80, bodyFatPct: 20, bmi: 24 },
      { date: "2026-08-05", weightKg: 80, bodyFatPct: null, bmi: null },
      { date: "2026-08-07", weightKg: 80, bodyFatPct: 22, bmi: 26 },
    ]);
    expect(points[0].bodyFatPct).toBe(21);
    expect(points[0].bmi).toBe(25);
  });

  it("reports null rather than 0 when no entry carried body fat", () => {
    const points = toWeeklyWeights([{ date: "2026-08-03", weightKg: 80 }]);
    expect(points[0].bodyFatPct).toBeNull();
  });

  it("handles an empty history", () => {
    expect(toWeeklyWeights([])).toEqual([]);
  });
});

describe("toWeeklyActivity", () => {
  it("returns exactly the requested number of weeks, oldest first, ending this week", () => {
    const weeks = toWeeklyActivity({ foodDates: [], workoutDates: [] }, 4, NOW);
    expect(weeks).toHaveLength(4);
    expect(weeks.map((w) => w.weekKey)).toEqual([
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
      "2026-08-03",
    ]);
  });

  it("includes silent weeks as zeroes, not as gaps", () => {
    const weeks = toWeeklyActivity({ foodDates: ["2026-08-04"], workoutDates: [] }, 3, NOW);
    expect(weeks.map((w) => w.daysLogged)).toEqual([0, 0, 1]);
  });

  it("counts a day once even when food and a workout both landed on it", () => {
    const weeks = toWeeklyActivity(
      { foodDates: ["2026-08-04"], workoutDates: ["2026-08-04"] },
      1,
      NOW
    );
    expect(weeks[0].daysLogged).toBe(1);
    expect(weeks[0].workouts).toBe(1);
  });

  it("sums training minutes, treating a missing duration as zero", () => {
    const weeks = toWeeklyActivity(
      {
        foodDates: [],
        workoutDates: ["2026-08-04", "2026-08-06"],
        workoutMinutes: [45, null],
      },
      1,
      NOW
    );
    expect(weeks[0].trainingMinutes).toBe(45);
    expect(weeks[0].workouts).toBe(2);
  });

  it("ignores activity outside the window", () => {
    const weeks = toWeeklyActivity({ foodDates: ["2025-01-01"], workoutDates: [] }, 2, NOW);
    expect(weeks.every((w) => w.daysLogged === 0)).toBe(true);
  });
});

describe("macroEnergySplit", () => {
  it("splits by calories, not by grams", () => {
    // Equal grams of each: fat carries 9 kcal/g vs 4, so it must dominate.
    const split = macroEnergySplit({ proteinG: 100, carbsG: 100, fatG: 100 })!;
    expect(split.fat).toBeGreaterThan(split.protein);
    expect(split.fat).toBeGreaterThan(split.carbs);
    expect(split.protein).toBe(split.carbs);
  });

  it("always sums to exactly 100 despite rounding", () => {
    for (const totals of [
      { proteinG: 33, carbsG: 33, fatG: 33 },
      { proteinG: 1, carbsG: 1, fatG: 1 },
      { proteinG: 150, carbsG: 200, fatG: 70 },
      { proteinG: 7, carbsG: 13, fatG: 3 },
    ]) {
      const split = macroEnergySplit(totals)!;
      expect(split.protein + split.carbs + split.fat).toBe(100);
    }
  });

  it("returns null when nothing has been logged", () => {
    expect(macroEnergySplit({ proteinG: 0, carbsG: 0, fatG: 0 })).toBeNull();
  });

  it("handles a single-macro day", () => {
    const split = macroEnergySplit({ proteinG: 50, carbsG: 0, fatG: 0 })!;
    expect(split).toEqual({ protein: 100, carbs: 0, fat: 0 });
  });
});
