/**
 * Validation for LLM-generated plans.
 *
 * Free-tier models return malformed JSON regularly — truncated objects, prose
 * wrapped around the payload, invented fields, macros as strings. Everything
 * here treats model output as untrusted input, because a plan that reaches
 * coach_plan_items unchecked writes garbage a user then eats from.
 *
 * Shapes mirror the DB CHECK constraints in
 * supabase/migrations/20260806000003_create_coach_plans.sql — if a constraint
 * changes there, it changes here too.
 */

import { z } from "zod";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export const WORKOUT_SLOTS = ["am", "pm"] as const;

// Per-item sanity ceilings. Not nutrition advice — just bounds that catch a
// model emitting 50000 kcal for a bowl of oats.
const MAX_ITEM_KCAL = 3000;
const MAX_ITEM_MACRO_G = 500;

const mealItemSchema = z.object({
  itemType: z.literal("meal"),
  dayIndex: z.number().int().min(0).max(364),
  slot: z.enum(MEAL_SLOTS),
  title: z.string().trim().min(1).max(200),
  kcal: z.number().int().min(0).max(MAX_ITEM_KCAL),
  proteinG: z.number().min(0).max(MAX_ITEM_MACRO_G),
  carbsG: z.number().min(0).max(MAX_ITEM_MACRO_G),
  fatG: z.number().min(0).max(MAX_ITEM_MACRO_G),
  details: z
    .object({
      ingredients: z
        .array(z.object({ name: z.string().trim().min(1).max(120), grams: z.number().positive().max(5000) }))
        .max(40)
        .default([]),
      notes: z.string().max(1000).optional(),
    })
    .default({ ingredients: [] }),
});

const workoutItemSchema = z.object({
  itemType: z.literal("workout"),
  dayIndex: z.number().int().min(0).max(364),
  slot: z.enum(WORKOUT_SLOTS),
  title: z.string().trim().min(1).max(200),
  details: z
    .object({
      exercises: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(120),
            sets: z.number().int().positive().max(20).optional(),
            reps: z.string().max(40).optional(),
            durationMin: z.number().positive().max(600).optional(),
            restSec: z.number().int().min(0).max(900).optional(),
            warmup: z.boolean().optional(),
          })
        )
        .min(1)
        .max(30),
      notes: z.string().max(1000).optional(),
    })
    .strict(),
});

// Discriminated union enforces the DB's macros_match_type rule: a workout
// carries no macros, a meal must carry them.
export const planItemSchema = z.discriminatedUnion("itemType", [mealItemSchema, workoutItemSchema]);

export const generatedPlanSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    weeks: z.number().int().min(1).max(52),
    items: z.array(planItemSchema).min(1).max(1000),
    // General lifestyle guidance shown alongside the plan. Optional so a model
    // that omits the field still yields a usable plan rather than failing.
    healthTips: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  })
  .superRefine((plan, ctx) => {
    // A plan whose items fall outside its own stated duration is incoherent —
    // the planner would render days the plan claims not to cover.
    const maxDay = plan.weeks * 7 - 1;
    plan.items.forEach((item, i) => {
      if (item.dayIndex > maxDay) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "dayIndex"],
          message: `dayIndex ${item.dayIndex} exceeds the plan's ${plan.weeks}-week span (max ${maxDay})`,
        });
      }
    });

    // Duplicate (day, slot) pairs would collide in the planner grid.
    const seen = new Set<string>();
    plan.items.forEach((item, i) => {
      const key = `${item.dayIndex}:${item.itemType}:${item.slot}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i],
          message: `duplicate ${item.itemType} in slot "${item.slot}" on day ${item.dayIndex}`,
        });
      }
      seen.add(key);
    });

    // A plan with no meals cannot drive the calorie tracker.
    if (!plan.items.some((i) => i.itemType === "meal")) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "plan contains no meals" });
    }
  });

export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
export type GeneratedPlanItem = z.infer<typeof planItemSchema>;

export type PlanParseResult =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; error: string };

/**
 * Pulls a JSON object out of a raw completion. Models wrap payloads in prose or
 * ```json fences despite instructions not to, so locate the outermost braces
 * rather than trusting the whole string to parse.
 */
export function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  return candidate.slice(start, end + 1);
}

/** Single entry point for turning a raw completion into a trusted plan. */
export function parsePlan(raw: string): PlanParseResult {
  const json = extractJson(raw);
  if (!json) return { ok: false, error: "no JSON object found in model output" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `malformed JSON: ${e instanceof Error ? e.message : "unknown"}` };
  }

  const result = generatedPlanSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: `schema validation failed — ${issues}` };
  }

  return { ok: true, plan: result.data };
}

/** All exercise names across a plan's workouts, for the equipment guardrail. */
export function allExerciseNames(plan: GeneratedPlan): string[] {
  return plan.items
    .filter((i): i is Extract<GeneratedPlanItem, { itemType: "workout" }> => i.itemType === "workout")
    .flatMap((i) => i.details.exercises.map((e) => e.name));
}

/** Totals a day's planned meals, for cross-checking against the user's target. */
export function dailyPlannedKcal(plan: GeneratedPlan, dayIndex: number): number {
  return plan.items
    .filter((i): i is Extract<GeneratedPlanItem, { itemType: "meal" }> => i.itemType === "meal" && i.dayIndex === dayIndex)
    .reduce((sum, i) => sum + i.kcal, 0);
}
