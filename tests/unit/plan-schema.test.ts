import { describe, it, expect } from "vitest";
import { extractJson, parsePlan, dailyPlannedKcal, type GeneratedPlan } from "@/lib/ai/plan-schema";

// Minimal valid plan, spread-and-override in individual tests.
function validPlan(overrides: Record<string, unknown> = {}) {
  return {
    summary: "4-week fat loss plan",
    weeks: 1,
    items: [
      {
        itemType: "meal",
        dayIndex: 0,
        slot: "breakfast",
        title: "Oats and whey",
        kcal: 350,
        proteinG: 12,
        carbsG: 55,
        fatG: 6,
        details: { ingredients: [{ name: "Rolled oats", grams: 80 }] },
      },
      {
        itemType: "workout",
        dayIndex: 0,
        slot: "am",
        title: "Easy 5k",
        details: { exercises: [{ name: "Run", durationMin: 30 }] },
      },
    ],
    ...overrides,
  };
}

describe("extractJson", () => {
  it("reads a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("strips ```json fences the model adds despite instructions", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips unlabelled fences", () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("digs the object out of surrounding prose", () => {
    expect(extractJson('Sure! Here is your plan:\n{"a":1}\nLet me know!')).toBe('{"a":1}');
  });

  it("returns null when there is no object at all", () => {
    expect(extractJson("I cannot help with that request.")).toBeNull();
  });

  it("returns null on a truncated object with no closing brace", () => {
    expect(extractJson('{"a":1')).toBeNull();
  });
});

describe("parsePlan — accepts valid output", () => {
  it("parses a well-formed plan", () => {
    const result = parsePlan(JSON.stringify(validPlan()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.items).toHaveLength(2);
      expect(result.plan.summary).toBe("4-week fat loss plan");
    }
  });

  it("parses through prose and fences", () => {
    expect(parsePlan("Here you go:\n```json\n" + JSON.stringify(validPlan()) + "\n```").ok).toBe(true);
  });

  it("defaults meal details when the model omits them", () => {
    const plan = validPlan({
      items: [{ itemType: "meal", dayIndex: 0, slot: "lunch", title: "Chicken rice", kcal: 600, proteinG: 40, carbsG: 70, fatG: 12 }],
    });
    const result = parsePlan(JSON.stringify(plan));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.items[0]).toMatchObject({ details: { ingredients: [] } });
  });
});

// Each case below is a failure mode free-tier models actually produce.
// Volume now comes from lib/coach/prescription.ts, but `details` is .strict()
// and models keep emitting the old keys out of habit — so those keys must
// still parse, or every such generation becomes a hard failure for no gain.
describe("parsePlan — prescription-era compatibility", () => {
  it("accepts the new per-exercise mode field", () => {
    const plan = validPlan({
      items: [
        { itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 },
        {
          itemType: "workout",
          dayIndex: 0,
          slot: "am",
          title: "Lower body",
          details: { exercises: [{ name: "Plank", mode: "time", warmup: false }] },
        },
      ],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(true);
  });

  it("still accepts legacy sets/reps a model volunteers", () => {
    const plan = validPlan({
      items: [
        { itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 },
        {
          itemType: "workout",
          dayIndex: 0,
          slot: "am",
          title: "Lower body",
          details: { exercises: [{ name: "Squat", sets: 3, reps: "8-12", restSec: 60 }] },
        },
      ],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(true);
  });

  it("rejects an unknown exercise key — .strict() still holds", () => {
    const plan = validPlan({
      items: [
        { itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 },
        {
          itemType: "workout",
          dayIndex: 0,
          slot: "am",
          title: "Lower body",
          details: { exercises: [{ name: "Squat" }], tempo: "3-1-1" },
        },
      ],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });
});

describe("parsePlan — rejects malformed output", () => {
  it("rejects a refusal with no JSON", () => {
    const result = parsePlan("I'm sorry, I can't create a meal plan.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no JSON object");
  });

  it("rejects truncated JSON (hit the token limit)", () => {
    const result = parsePlan('{"summary":"plan","weeks":1,"items":[{"itemType":"meal"');
    expect(result.ok).toBe(false);
  });

  it("rejects macros sent as strings", () => {
    const plan = validPlan({
      items: [{ itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: "350", proteinG: 12, carbsG: 55, fatG: 6 }],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });

  it("rejects a workout carrying macros (violates the DB CHECK)", () => {
    const plan = validPlan({
      items: [{ itemType: "workout", dayIndex: 0, slot: "am", title: "Run", kcal: 500, details: { exercises: [{ name: "Run" }] } }],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });

  it("rejects a meal in a workout slot (violates the DB CHECK)", () => {
    const plan = validPlan({
      items: [{ itemType: "meal", dayIndex: 0, slot: "am", title: "Lunch", kcal: 600, proteinG: 40, carbsG: 70, fatG: 12 }],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });

  it("rejects an invented item type", () => {
    const plan = validPlan({
      items: [{ itemType: "supplement", dayIndex: 0, slot: "am", title: "Creatine" }],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });

  it("rejects an absurd calorie count", () => {
    const plan = validPlan({
      items: [{ itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 50000, proteinG: 12, carbsG: 55, fatG: 6 }],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });

  it("rejects negative macros", () => {
    const plan = validPlan({
      items: [{ itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 350, proteinG: -5, carbsG: 55, fatG: 6 }],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });

  it("rejects an empty plan", () => {
    expect(parsePlan(JSON.stringify(validPlan({ items: [] }))).ok).toBe(false);
  });

  it("rejects a plan with no meals — the tracker needs them", () => {
    const plan = validPlan({
      items: [{ itemType: "workout", dayIndex: 0, slot: "am", title: "Run", details: { exercises: [{ name: "Run" }] } }],
    });
    const result = parsePlan(JSON.stringify(plan));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no meals");
  });

  it("rejects a dayIndex beyond the plan's own duration", () => {
    const plan = validPlan({
      weeks: 1,
      items: [{ itemType: "meal", dayIndex: 30, slot: "breakfast", title: "Oats", kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 }],
    });
    const result = parsePlan(JSON.stringify(plan));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("exceeds");
  });

  it("rejects duplicate day+slot pairs that would collide in the planner", () => {
    const meal = { itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 };
    const result = parsePlan(JSON.stringify(validPlan({ items: [meal, { ...meal, title: "Eggs" }] })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicate");
  });

  it("rejects a workout with no exercises", () => {
    const plan = validPlan({
      items: [{ itemType: "workout", dayIndex: 0, slot: "am", title: "Rest", details: { exercises: [] } }],
    });
    expect(parsePlan(JSON.stringify(plan)).ok).toBe(false);
  });

  it("rejects a JSON array at the root", () => {
    expect(parsePlan("[]").ok).toBe(false);
  });
});

describe("dailyPlannedKcal", () => {
  const plan = parsePlan(
    JSON.stringify(
      validPlan({
        items: [
          { itemType: "meal", dayIndex: 0, slot: "breakfast", title: "Oats", kcal: 350, proteinG: 12, carbsG: 55, fatG: 6 },
          { itemType: "meal", dayIndex: 0, slot: "lunch", title: "Chicken", kcal: 600, proteinG: 40, carbsG: 70, fatG: 12 },
          { itemType: "meal", dayIndex: 1, slot: "breakfast", title: "Eggs", kcal: 400, proteinG: 25, carbsG: 5, fatG: 28 },
          { itemType: "workout", dayIndex: 0, slot: "am", title: "Run", details: { exercises: [{ name: "Run" }] } },
        ],
      })
    )
  );
  const parsed = (plan.ok ? plan.plan : null) as GeneratedPlan;

  it("sums only that day's meals", () => {
    expect(dailyPlannedKcal(parsed, 0)).toBe(950);
  });

  it("ignores workouts in the total", () => {
    expect(dailyPlannedKcal(parsed, 1)).toBe(400);
  });

  it("returns zero for a day with no meals", () => {
    expect(dailyPlannedKcal(parsed, 5)).toBe(0);
  });
});
