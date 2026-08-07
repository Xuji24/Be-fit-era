// Nutrition math for the AI coach: TDEE, calorie targets, and macro splits.
// Pure functions — no DB, no network. The safety clamps here are the primary
// guard against an AI-suggested unsafe target; the DB CHECK constraints on
// coach_profiles are the backstop.

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose_fat" | "build_muscle" | "maintain" | "endurance";

export interface IntakeMetrics {
  heightCm: number;
  weightKg: number;
  birthDate: string;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  dailyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  clamped: boolean;
}

// Lowest daily intake we will ever recommend, per sex. Below these levels a
// deficit stops being a diet and starts being a medical problem, so a model
// that suggests 800 kcal gets overridden rather than trusted.
export const KCAL_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Applied to TDEE. Deliberately moderate: a 20% deficit is sustainable, and
// aggressive cuts are what produce the unsafe targets we're clamping against.
const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose_fat: -0.2,
  build_muscle: 0.1,
  maintain: 0,
  endurance: 0.05,
};

// Protein g/kg bodyweight, and fat as a share of daily calories.
// Carbs take whatever calories remain.
const MACRO_RULES: Record<Goal, { proteinPerKg: number; fatRatio: number }> = {
  lose_fat: { proteinPerKg: 2.0, fatRatio: 0.25 },
  build_muscle: { proteinPerKg: 1.8, fatRatio: 0.25 },
  maintain: { proteinPerKg: 1.6, fatRatio: 0.3 },
  endurance: { proteinPerKg: 1.4, fatRatio: 0.25 },
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

export function calculateBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

export function bmiCategory(bmi: number): "underweight" | "normal" | "overweight" | "obese" {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function calculateAge(birthDate: string, now = new Date()): number {
  const dob = new Date(birthDate);
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// Mifflin-St Jeor — more accurate than Harris-Benedict for modern populations.
export function calculateBmr(metrics: Omit<IntakeMetrics, "activityLevel" | "goal">, now?: Date): number {
  const age = calculateAge(metrics.birthDate, now);
  const base = 10 * metrics.weightKg + 6.25 * metrics.heightCm - 5 * age;
  return Math.round(metrics.sex === "male" ? base + 5 : base - 161);
}

export function calculateTdee(metrics: Omit<IntakeMetrics, "goal">, now?: Date): number {
  return Math.round(calculateBmr(metrics, now) * ACTIVITY_MULTIPLIERS[metrics.activityLevel]);
}

// Full target set. `clamped` is true when the goal adjustment would have gone
// below the floor — surface it in the UI so the user knows why their deficit
// is smaller than a naive calculation suggests.
export function calculateTargets(metrics: IntakeMetrics, now?: Date): NutritionTargets {
  const bmr = calculateBmr(metrics, now);
  const tdee = calculateTdee(metrics, now);

  const adjusted = Math.round(tdee * (1 + GOAL_ADJUSTMENTS[metrics.goal]));
  const floor = KCAL_FLOOR[metrics.sex];
  const dailyKcal = Math.max(adjusted, floor);

  const { proteinPerKg, fatRatio } = MACRO_RULES[metrics.goal];
  const proteinG = Math.round(metrics.weightKg * proteinPerKg);
  const fatG = Math.round((dailyKcal * fatRatio) / KCAL_PER_G.fat);

  // Carbs absorb the remainder. Protein and fat are fixed first because they
  // have physiological minimums; carbs do not.
  const remaining = dailyKcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  const carbsG = Math.max(0, Math.round(remaining / KCAL_PER_G.carbs));

  return { bmr, tdee, dailyKcal, proteinG, carbsG, fatG, clamped: adjusted < floor };
}

// Validates AI-proposed targets before they reach the DB. Returns the safe
// value plus a reason when the proposal was overridden.
export function enforceKcalFloor(proposedKcal: number, sex: Sex): { kcal: number; overridden: boolean } {
  const floor = KCAL_FLOOR[sex];
  return proposedKcal < floor ? { kcal: floor, overridden: true } : { kcal: proposedKcal, overridden: false };
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// Sums logged macros for a day. Used by the tracker and the progress charts.
export function sumMacros(
  logs: Array<{ kcal: number; proteinG?: number; carbsG?: number; fatG?: number }>
): MacroTotals {
  return logs.reduce<MacroTotals>(
    (acc, l) => ({
      kcal: acc.kcal + l.kcal,
      proteinG: round1(acc.proteinG + (l.proteinG ?? 0)),
      carbsG: round1(acc.carbsG + (l.carbsG ?? 0)),
      fatG: round1(acc.fatG + (l.fatG ?? 0)),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}

// Remaining allowance against a target. Negative means over budget — the
// tracker shows that as a surplus rather than hiding it at zero.
export function remainingAgainstTarget(consumed: number, target: number): number {
  return target - consumed;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
