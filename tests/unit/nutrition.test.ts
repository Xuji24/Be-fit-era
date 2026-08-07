import { describe, it, expect } from "vitest";
import {
  calculateBmi,
  bmiCategory,
  calculateAge,
  calculateBmr,
  calculateTdee,
  calculateTargets,
  enforceKcalFloor,
  sumMacros,
  remainingAgainstTarget,
  KCAL_FLOOR,
  type IntakeMetrics,
} from "@/lib/coach/nutrition";

// Fixed clock so age-dependent expectations never drift as real time passes.
const NOW = new Date("2026-08-05T00:00:00Z");

const MALE_70KG: IntakeMetrics = {
  heightCm: 175,
  weightKg: 70,
  birthDate: "1995-01-01",
  sex: "male",
  activityLevel: "moderate",
  goal: "lose_fat",
};

describe("calculateBmi", () => {
  it("matches the DB generated column (70kg / 1.75m^2)", () => {
    expect(calculateBmi(175, 70)).toBe(22.9);
  });

  it("handles a higher BMI", () => {
    expect(calculateBmi(180, 100)).toBe(30.9);
  });
});

describe("bmiCategory", () => {
  it.each([
    [17, "underweight"],
    [18.5, "normal"],
    [22.9, "normal"],
    [25, "overweight"],
    [30, "obese"],
  ] as const)("classifies %s as %s", (bmi, expected) => {
    expect(bmiCategory(bmi)).toBe(expected);
  });
});

describe("calculateAge", () => {
  it("does not count a birthday that has not arrived yet", () => {
    expect(calculateAge("1995-12-01", NOW)).toBe(30);
  });

  it("counts a birthday already passed", () => {
    expect(calculateAge("1995-01-01", NOW)).toBe(31);
  });

  it("counts the birthday itself", () => {
    expect(calculateAge("1995-08-05", NOW)).toBe(31);
  });
});

describe("calculateBmr (Mifflin-St Jeor)", () => {
  // 10(70) + 6.25(175) - 5(31) + 5 = 1643.75 -> 1644
  it("computes male BMR", () => {
    expect(calculateBmr({ heightCm: 175, weightKg: 70, birthDate: "1995-01-01", sex: "male" }, NOW)).toBe(1644);
  });

  // 10(60) + 6.25(165) - 5(31) - 161 = 1315.25 -> 1315
  it("computes female BMR", () => {
    expect(calculateBmr({ heightCm: 165, weightKg: 60, birthDate: "1995-01-01", sex: "female" }, NOW)).toBe(1315);
  });
});

describe("calculateTdee", () => {
  it("applies the moderate multiplier (1644 * 1.55)", () => {
    expect(calculateTdee({ ...MALE_70KG, activityLevel: "moderate" }, NOW)).toBe(2548);
  });

  it("applies the sedentary multiplier (1644 * 1.2)", () => {
    expect(calculateTdee({ ...MALE_70KG, activityLevel: "sedentary" }, NOW)).toBe(1973);
  });
});

describe("calculateTargets", () => {
  const targets = calculateTargets(MALE_70KG, NOW);

  it("applies the lose_fat deficit (2548 * 0.8)", () => {
    expect(targets.dailyKcal).toBe(2038);
    expect(targets.clamped).toBe(false);
  });

  it("sets protein from bodyweight (70kg * 2.0 g/kg)", () => {
    expect(targets.proteinG).toBe(140);
  });

  it("sets fat as a share of calories (2038 * 0.25 / 9)", () => {
    expect(targets.fatG).toBe(57);
  });

  it("gives carbs the remaining calories", () => {
    expect(targets.carbsG).toBe(241);
  });

  // The split is only correct if it reconstructs the target; rounding each
  // macro independently is allowed to drift by a few kcal, not more.
  it("reconstructs the calorie target from its macros", () => {
    const reconstructed = targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9;
    expect(Math.abs(reconstructed - targets.dailyKcal)).toBeLessThanOrEqual(5);
  });

  it("applies a surplus for build_muscle (2548 * 1.1)", () => {
    expect(calculateTargets({ ...MALE_70KG, goal: "build_muscle" }, NOW).dailyKcal).toBe(2803);
  });

  it("leaves maintain at TDEE", () => {
    expect(calculateTargets({ ...MALE_70KG, goal: "maintain" }, NOW).dailyKcal).toBe(2548);
  });
});

// The safety guardrail. A model that proposes a starvation-level target must be
// overridden here, before the value ever reaches the DB.
describe("calorie floor", () => {
  // Sedentary 40kg female on lose_fat computes to ~981 kcal — genuinely unsafe.
  const tiny = calculateTargets(
    { heightCm: 150, weightKg: 40, birthDate: "1995-01-01", sex: "female", activityLevel: "sedentary", goal: "lose_fat" },
    NOW
  );

  it("clamps an unsafe computed target up to the floor", () => {
    expect(tiny.dailyKcal).toBe(KCAL_FLOOR.female);
    expect(tiny.clamped).toBe(true);
  });

  it("never returns a value the DB CHECK would reject", () => {
    expect(tiny.dailyKcal).toBeGreaterThanOrEqual(1200);
  });

  it.each([
    [800, "male", { kcal: 1500, overridden: true }],
    [800, "female", { kcal: 1200, overridden: true }],
    [2000, "male", { kcal: 2000, overridden: false }],
    [1200, "female", { kcal: 1200, overridden: false }],
  ] as const)("enforceKcalFloor(%s, %s)", (proposed, sex, expected) => {
    expect(enforceKcalFloor(proposed, sex)).toEqual(expected);
  });
});

describe("sumMacros", () => {
  it("returns zeroes for an empty day", () => {
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("totals planned and manual logs together", () => {
    expect(
      sumMacros([
        { kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 },
        { kcal: 200, proteinG: 3, carbsG: 20, fatG: 11 },
      ])
    ).toEqual({ kcal: 550, proteinG: 15, carbsG: 75, fatG: 17 });
  });

  it("treats missing macros as zero rather than NaN", () => {
    expect(sumMacros([{ kcal: 100 }])).toEqual({ kcal: 100, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe("remainingAgainstTarget", () => {
  it("reports what is left under budget", () => {
    expect(remainingAgainstTarget(1500, 2038)).toBe(538);
  });

  it("goes negative over budget instead of clamping at zero", () => {
    expect(remainingAgainstTarget(2200, 2038)).toBe(-162);
  });
});
