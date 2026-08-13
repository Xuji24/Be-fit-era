import { describe, it, expect } from "vitest";
import {
  prescribe,
  detectEffortMode,
  formatPrescription,
  formatRest,
  readExerciseDisplay,
  readExerciseRest,
  parseExperienceLevel,
  parseGoal,
  exercisesPerSession,
  applyPrescriptions,
  type CoachGoal,
  type ExperienceLevel,
  type EffortMode,
  type Prescription,
} from "@/lib/coach/prescription";
import type { GeneratedPlan } from "@/lib/ai/plan-schema";

const GOALS: CoachGoal[] = ["lose_fat", "build_muscle", "maintain", "endurance"];
const LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];
const MODES: EffortMode[] = ["reps", "time"];

/** Every (goal × experience × warmup × mode) combination — 48 cells. */
function allCombos() {
  const out: { goal: CoachGoal; level: ExperienceLevel; warmup: boolean; mode: EffortMode }[] = [];
  for (const goal of GOALS) {
    for (const level of LEVELS) {
      for (const warmup of [false, true]) {
        for (const mode of MODES) out.push({ goal, level, warmup, mode });
      }
    }
  }
  return out;
}

describe("prescribe — the rule table is the spec", () => {
  it("gives a hypertrophy scheme for build_muscle", () => {
    expect(prescribe("reps", false, { goal: "build_muscle", experienceLevel: "beginner" })).toEqual({
      mode: "reps",
      sets: 3,
      reps: { min: 8, max: 12 },
      restSec: 60,
    });
    expect(prescribe("reps", false, { goal: "build_muscle", experienceLevel: "advanced" })).toEqual({
      mode: "reps",
      sets: 3,
      reps: { min: 6, max: 10 },
      restSec: 90,
    });
  });

  it("gives higher reps and shorter rest for lose_fat", () => {
    expect(prescribe("reps", false, { goal: "lose_fat", experienceLevel: "intermediate" })).toEqual({
      mode: "reps",
      sets: 3,
      reps: { min: 12, max: 15 },
      restSec: 45,
    });
  });

  it("gives the muscular-endurance range for endurance", () => {
    expect(prescribe("reps", false, { goal: "endurance", experienceLevel: "advanced" })).toEqual({
      mode: "reps",
      sets: 3,
      reps: { min: 15, max: 20 },
      restSec: 30,
    });
  });

  it("uses timed holds for time-mode work", () => {
    expect(prescribe("time", false, { goal: "build_muscle", experienceLevel: "intermediate" })).toEqual({
      mode: "time",
      sets: 3,
      durationSec: 45,
      restSec: 45,
    });
    // lose_fat/endurance route to the conditioning bucket — shorter rest.
    expect(prescribe("time", false, { goal: "lose_fat", experienceLevel: "advanced" })).toEqual({
      mode: "time",
      sets: 3,
      durationSec: 60,
      restSec: 20,
    });
  });
});

describe("prescribe — invariants", () => {
  it("is deterministic: same inputs always yield the same numbers", () => {
    for (const { goal, level, warmup, mode } of allCombos()) {
      const ctx = { goal, experienceLevel: level };
      expect(prescribe(mode, warmup, ctx)).toEqual(prescribe(mode, warmup, ctx));
    }
  });

  it("short-circuits warm-ups to one easy set with no programmed rest", () => {
    for (const goal of GOALS) {
      for (const level of LEVELS) {
        const ctx = { goal, experienceLevel: level };
        expect(prescribe("reps", true, ctx)).toEqual({ mode: "reps", sets: 1, reps: { min: 8, max: 10 }, restSec: 0 });
        expect(prescribe("time", true, ctx)).toEqual({ mode: "time", sets: 1, durationSec: 30, restSec: 0 });
      }
    }
  });

  it("never gives more than three sets, at any goal or experience level", () => {
    // Total session volume is controlled by exercise count now (see
    // exercisesPerSession), not by stacking sets on one movement — a
    // duplicated-exercise bug once made a single squat block read as 8
    // total sets across two listings. This is the regression guard for the
    // deliberate global cap that replaced the old up-to-4 advanced/
    // intermediate rows.
    for (const goal of GOALS) {
      for (const level of LEVELS) {
        for (const mode of MODES) {
          expect(prescribe(mode, false, { goal, experienceLevel: level }).sets).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it("holds structural invariants across every combination", () => {
    for (const { goal, level, warmup, mode } of allCombos()) {
      const p = prescribe(mode, warmup, { goal, experienceLevel: level });
      expect(p.sets).toBeGreaterThanOrEqual(1);
      expect(p.restSec).toBeGreaterThanOrEqual(0);
      expect(p.restSec).toBeLessThanOrEqual(900);
      if (p.mode === "reps") {
        expect(p.reps.min).toBeGreaterThanOrEqual(1);
        expect(p.reps.min).toBeLessThanOrEqual(p.reps.max);
      } else {
        expect(p.durationSec).toBeGreaterThan(0);
      }
    }
  });

  it("prescribes higher reps for endurance than for hypertrophy at every level", () => {
    for (const level of LEVELS) {
      const endurance = prescribe("reps", false, { goal: "endurance", experienceLevel: level });
      const muscle = prescribe("reps", false, { goal: "build_muscle", experienceLevel: level });
      if (endurance.mode !== "reps" || muscle.mode !== "reps") throw new Error("expected rep mode");
      expect(endurance.reps.min).toBeGreaterThanOrEqual(muscle.reps.min);
    }
  });

  it("keeps the union clean — no cross-contaminated keys", () => {
    for (const { goal, level, warmup, mode } of allCombos()) {
      const p = prescribe(mode, warmup, { goal, experienceLevel: level }) as Record<string, unknown>;
      if (mode === "time") {
        expect(p.reps).toBeUndefined();
        expect(p.durationSec).toBeDefined();
      } else {
        expect(p.durationSec).toBeUndefined();
        expect(p.reps).toBeDefined();
      }
    }
  });

  it("deload drops a set (floor 2) and adds rest", () => {
    const normal = prescribe("reps", false, { goal: "build_muscle", experienceLevel: "advanced" });
    const deloaded = prescribe("reps", false, { goal: "build_muscle", experienceLevel: "advanced", deload: true });
    expect(deloaded.sets).toBe(normal.sets - 1);
    expect(deloaded.restSec).toBe(normal.restSec + 15);

    // maintain/beginner is already 2 sets — the floor holds.
    const floored = prescribe("reps", false, { goal: "maintain", experienceLevel: "beginner", deload: true });
    expect(floored.sets).toBe(2);
  });
});

describe("detectEffortMode", () => {
  it("trusts an explicit mode from the model over any heuristic", () => {
    expect(detectEffortMode({ name: "Push-up", mode: "time" })).toBe("time");
    expect(detectEffortMode({ name: "Plank", mode: "reps" })).toBe("reps");
  });

  it("reads durationMin as a time signal when reps is absent", () => {
    expect(detectEffortMode({ name: "Unknown movement", durationMin: 2 })).toBe("time");
  });

  it("detects a duration hiding in the free-text reps field", () => {
    for (const reps of ["45 seconds", "30s", "1 min", "1:30", "60 sec"]) {
      expect(detectEffortMode({ name: "Unknown movement", reps })).toBe("time");
    }
  });

  it("matches timed movements by concept", () => {
    for (const name of [
      "Plank",
      "Side plank",
      "Wall sit",
      "High knees",
      "Jumping jacks",
      "Mountain climbers",
      "Jump rope",
      "Dead hang",
      "Farmer's carry",
      "Child's pose",
      "Hamstring stretch",
      "Hollow body hold",
    ]) {
      expect(detectEffortMode({ name })).toBe("time");
    }
  });

  it("does not misfire on rep-based names that merely contain a timed word", () => {
    // Each of these would break under naive substring matching.
    for (const name of ["Wall push-up", "Jump squat", "Bent-over row", "Inverted row", "Glute bridge", "Push-up"]) {
      expect(detectEffortMode({ name })).toBe("reps");
    }
  });

  it("treats dynamic plank variants as rep-based", () => {
    for (const name of ["Plank to push-up", "Plank row", "Plank jacks", "Plank shoulder taps"]) {
      expect(detectEffortMode({ name })).toBe("reps");
    }
    // ...but a plain hold is still timed.
    expect(detectEffortMode({ name: "Plank" })).toBe("time");
  });

  it("normalizes case and parentheticals", () => {
    expect(detectEffortMode({ name: "PLANK (forearm)" })).toBe("time");
  });

  it("defaults an unrecognised name to reps", () => {
    expect(detectEffortMode({ name: "Bulgarian split squat" })).toBe("reps");
    expect(detectEffortMode({ name: "Turkish get-up" })).toBe("reps");
  });
});

describe("formatPrescription", () => {
  it("renders a rep range", () => {
    expect(formatPrescription({ mode: "reps", sets: 3, reps: { min: 8, max: 12 }, restSec: 60 })).toBe("3 × 8-12");
  });

  it("collapses an equal range to a single number", () => {
    expect(formatPrescription({ mode: "reps", sets: 3, reps: { min: 10, max: 10 }, restSec: 60 })).toBe("3 × 10");
  });

  it("uses the multiplication sign, not the letter x", () => {
    expect(formatPrescription({ mode: "reps", sets: 3, reps: { min: 8, max: 12 }, restSec: 60 })).toContain("×");
  });

  it("renders seconds below two minutes and whole minutes above", () => {
    expect(formatPrescription({ mode: "time", sets: 3, durationSec: 45, restSec: 45 })).toBe("3 × 45s");
    expect(formatPrescription({ mode: "time", sets: 3, durationSec: 90, restSec: 45 })).toBe("3 × 90s");
    expect(formatPrescription({ mode: "time", sets: 3, durationSec: 120, restSec: 45 })).toBe("3 × 2 min");
  });
});

describe("formatRest", () => {
  it("names the no-rest case rather than printing 0s", () => {
    expect(formatRest(0)).toBe("no rest");
  });

  it("renders seconds and whole minutes", () => {
    expect(formatRest(60)).toBe("60s rest");
    expect(formatRest(120)).toBe("2 min rest");
    expect(formatRest(90)).toBe("90s rest");
  });
});

describe("readExerciseDisplay — the crash shield", () => {
  it("formats the current persisted shape", () => {
    const raw = { name: "Squat", warmup: false, prescription: { mode: "reps", sets: 3, reps: { min: 8, max: 12 }, restSec: 60 } };
    expect(readExerciseDisplay(raw)).toBe("3 × 8-12");
  });

  it("still renders legacy rows written before prescriptions existed", () => {
    expect(readExerciseDisplay({ name: "Squat", sets: 3, reps: "8-12" })).toBe("3 × 8-12");
    expect(readExerciseDisplay({ name: "Squat", sets: 3 })).toBe("3 sets");
    expect(readExerciseDisplay({ name: "Squat", sets: 1 })).toBe("1 set");
    expect(readExerciseDisplay({ name: "Plank", durationMin: 2 })).toBe("2 min");
  });

  it("returns null rather than a half-formed string when there is nothing to show", () => {
    expect(readExerciseDisplay({ name: "Squat" })).toBeNull();
  });

  it("never throws on garbage", () => {
    const garbage: unknown[] = [
      null,
      undefined,
      "a string",
      42,
      [],
      { prescription: null },
      { prescription: { mode: "bogus" } },
      { prescription: { mode: "reps" } },
      { prescription: { mode: "reps", sets: 3, restSec: 60 } },
      { prescription: { mode: "time", sets: 3, restSec: 60 } },
      { sets: "three" },
      { sets: 3, reps: 12 },
      { reps: "8-12" },
    ];
    for (const value of garbage) {
      expect(() => readExerciseDisplay(value)).not.toThrow();
    }
    // Specifically: a numeric reps field must not produce "3 × 12" from an
    // unvalidated shape — it falls through to the sets-only branch.
    expect(readExerciseDisplay({ sets: 3, reps: 12 })).toBe("3 sets");
    expect(readExerciseDisplay({ sets: "three" })).toBeNull();
    expect(readExerciseDisplay(42)).toBeNull();
  });
});

describe("readExerciseRest", () => {
  it("reads rest from the current shape", () => {
    const raw = { prescription: { mode: "reps", sets: 3, reps: { min: 8, max: 12 }, restSec: 60 } };
    expect(readExerciseRest(raw)).toBe("60s rest");
  });

  it("returns null for legacy rows, which never stored rest", () => {
    expect(readExerciseRest({ name: "Squat", sets: 3, reps: "8-12" })).toBeNull();
    expect(readExerciseRest(null)).toBeNull();
  });
});

describe("parseExperienceLevel / parseGoal", () => {
  it("round-trips valid values", () => {
    for (const level of LEVELS) expect(parseExperienceLevel(level)).toBe(level);
    for (const goal of GOALS) expect(parseGoal(goal)).toBe(goal);
  });

  it("falls back to a documented default for anything else", () => {
    for (const bad of [null, undefined, "", "bulk", 7, {}]) {
      expect(parseExperienceLevel(bad)).toBe("beginner");
      expect(parseGoal(bad)).toBe("maintain");
    }
  });
});

describe("exercisesPerSession", () => {
  it("scales with session length", () => {
    expect(exercisesPerSession(30)).toBe(6);
    expect(exercisesPerSession(45)).toBe(9);
    expect(exercisesPerSession(60)).toBe(12);
  });

  it("clamps at both ends", () => {
    expect(exercisesPerSession(10)).toBe(4);
    expect(exercisesPerSession(120)).toBe(12);
  });
});

function planWith(exercises: Record<string, unknown>[]): GeneratedPlan {
  return {
    summary: "test",
    weeks: 1,
    healthTips: [],
    items: [
      {
        itemType: "meal",
        dayIndex: 0,
        slot: "breakfast",
        title: "Oats",
        kcal: 350,
        proteinG: 12,
        carbsG: 55,
        fatG: 6,
        details: { ingredients: [{ name: "Oats", grams: 80 }] },
      },
      {
        itemType: "workout",
        dayIndex: 0,
        slot: "am",
        title: "Lower body",
        details: { exercises },
      },
    ],
  } as unknown as GeneratedPlan;
}

describe("applyPrescriptions", () => {
  const ctx = { goal: "build_muscle" as const, experienceLevel: "beginner" as const };

  it("replaces every exercise with a deterministic prescription", () => {
    const plan = applyPrescriptions(planWith([{ name: "Squat", sets: 9, reps: "AMRAP" }]), ctx);
    const workout = plan.items.find((i) => i.itemType === "workout");
    const exercise = (workout as { details: { exercises: Record<string, unknown>[] } }).details.exercises[0];

    expect(exercise.prescription).toEqual({ mode: "reps", sets: 3, reps: { min: 8, max: 12 }, restSec: 60 });
    // The model's own numbers must be gone, not merely shadowed.
    expect(exercise.sets).toBeUndefined();
    expect(exercise.reps).toBeUndefined();
    expect(exercise.durationMin).toBeUndefined();
    expect(exercise.restSec).toBeUndefined();
  });

  it("routes warm-ups and working sets differently within one workout", () => {
    const plan = applyPrescriptions(
      planWith([
        { name: "Arm circles", warmup: true },
        { name: "Squat" },
      ]),
      ctx
    );
    const exercises = (plan.items.find((i) => i.itemType === "workout") as unknown as {
      details: { exercises: { prescription: Prescription }[] };
    }).details.exercises;

    expect(exercises[0].prescription.sets).toBe(1);
    expect(exercises[1].prescription.sets).toBe(3);
  });

  it("puts each exercise on the right union branch", () => {
    const plan = applyPrescriptions(planWith([{ name: "Plank" }, { name: "Squat" }]), ctx);
    const exercises = (plan.items.find((i) => i.itemType === "workout") as unknown as {
      details: { exercises: { prescription: Prescription }[] };
    }).details.exercises;

    expect(exercises[0].prescription.mode).toBe("time");
    expect(exercises[1].prescription.mode).toBe("reps");
  });

  it("leaves meal items untouched", () => {
    const input = planWith([{ name: "Squat" }]);
    const plan = applyPrescriptions(input, ctx);
    expect(plan.items.find((i) => i.itemType === "meal")).toEqual(input.items.find((i) => i.itemType === "meal"));
  });

  it("does not mutate the input — the caller still holds the original plan", () => {
    const input = planWith([{ name: "Squat", sets: 9, reps: "AMRAP" }]);
    applyPrescriptions(input, ctx);

    const original = (input.items.find((i) => i.itemType === "workout") as {
      details: { exercises: Record<string, unknown>[] };
    }).details.exercises[0];
    expect(original.reps).toBe("AMRAP");
    expect(original.prescription).toBeUndefined();
  });

  it("produces identical output for the same profile across runs", () => {
    const a = applyPrescriptions(planWith([{ name: "Squat" }, { name: "Plank" }]), ctx);
    const b = applyPrescriptions(planWith([{ name: "Squat" }, { name: "Plank" }]), ctx);
    expect(a).toEqual(b);
  });
});
