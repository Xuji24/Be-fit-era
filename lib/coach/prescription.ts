/**
 * Deterministic training volume for generated plans.
 *
 * The governing rule, which everything here follows from:
 *
 *   The model chooses WHICH exercises and HOW they're measured.
 *   The table chooses HOW MUCH.
 *
 * Before this module, sets and reps came from the LLM. That produced free text
 * ("8-12", "10-12 per leg", "AMRAP") that the planner couldn't render, and two
 * generations for the same profile disagreed. Neither is acceptable for a
 * number a user is meant to follow in a gym.
 *
 * We always override the model's numbers rather than clamping them to a band.
 * Clamping keeps the model's value whenever it lands in range — which is most
 * of the time — so it yields bounded variance, not determinism. It also needs
 * a parser for the free-text rep field before it can compare anything. And the
 * "the model has context we don't" objection is weak here specifically: the
 * prompt never told it what rep scheme to target, so its numbers were
 * stylistic priors from training data rather than reasoning about this user.
 * There is no signal being discarded.
 *
 * Everything exported here is a pure function. Same inputs, same output, no
 * clock, no I/O — so the whole surface is exhaustively unit-testable.
 */

import type { GeneratedPlan } from "@/lib/ai/plan-schema";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type CoachGoal = "lose_fat" | "build_muscle" | "maintain" | "endurance";

/** How an exercise's work is counted. */
export type EffortMode = "reps" | "time";

export interface RepRange {
  min: number;
  max: number;
}

/**
 * A discriminated union rather than an object of optionals, so "a plank with a
 * rep count" and "a squat with neither reps nor duration" are unrepresentable,
 * and the UI gets an exhaustive switch instead of a chain of undefined checks.
 *
 * durationSec, not durationMin: a plank is 45 seconds, and `durationMin: 0.75`
 * is a data model apologising for itself. plan-schema.ts keeps durationMin
 * because that is what models emit; nothing persisted uses it.
 */
export type Prescription =
  | { mode: "reps"; sets: number; reps: RepRange; restSec: number }
  | { mode: "time"; sets: number; durationSec: number; restSec: number };

/** The shape persisted into coach_plan_items.details.exercises[]. */
export interface PrescribedExercise {
  name: string;
  warmup: boolean;
  prescription: Prescription;
}

/** What a model may emit, pre-normalization. Every field is untrusted. */
export interface RawExercise {
  name: string;
  mode?: EffortMode;
  sets?: number;
  reps?: string;
  durationMin?: number;
  restSec?: number;
  warmup?: boolean;
}

export interface PrescriptionContext {
  experienceLevel: ExperienceLevel;
  goal: CoachGoal;
  /**
   * Reserved: drop a set and add rest for a user training around a flagged
   * limitation. Wired to false today — shipping the field documents the
   * intended extension point, and keeping the judgement in a boolean here is
   * the right place for it rather than delegating it back to the model.
   */
  deload?: boolean;
}

// ============================================================
// Rule tables
// ============================================================
// Reasoning lives here so nobody "tidies" the numbers later:
//
// build_muscle — 6-12 reps at 60-90s rest is the standard hypertrophy
//   prescription. Advanced skews to lower reps and longer rest because heavier
//   loads need more recovery between sets.
// lose_fat — in a calorie deficit the training's job is stimulus retention
//   plus work density: higher reps, shorter rest. Set counts stay modest
//   because a deficit is itself a recovery tax.
// maintain — minimum effective dose. Moderate everything.
// endurance — 15-20 reps under 45s rest is the muscular-endurance range.
//
// No prescription exceeds 3 sets per exercise, at any goal or experience
// level. Deliberately conservative: novices get disproportionate soreness
// from volume and technique degrades under fatigue, and week-one adherence
// matters more than week-one stimulus — and now that a session can list
// several exercises back to back (see exercisesPerSession), total session
// volume is controlled by exercise COUNT, not by stacking sets on any one
// movement. Advanced/intermediate rows that used to reach 4 sets make up
// the difference with less rest and a tighter rep range instead.

const REP_TABLE: Record<CoachGoal, Record<ExperienceLevel, { sets: number; reps: RepRange; restSec: number }>> = {
  build_muscle: {
    beginner: { sets: 3, reps: { min: 8, max: 12 }, restSec: 60 },
    intermediate: { sets: 3, reps: { min: 8, max: 12 }, restSec: 75 },
    advanced: { sets: 3, reps: { min: 6, max: 10 }, restSec: 90 },
  },
  lose_fat: {
    beginner: { sets: 3, reps: { min: 10, max: 15 }, restSec: 45 },
    intermediate: { sets: 3, reps: { min: 12, max: 15 }, restSec: 45 },
    advanced: { sets: 3, reps: { min: 12, max: 15 }, restSec: 40 },
  },
  maintain: {
    beginner: { sets: 2, reps: { min: 10, max: 12 }, restSec: 60 },
    intermediate: { sets: 3, reps: { min: 10, max: 12 }, restSec: 60 },
    advanced: { sets: 3, reps: { min: 8, max: 12 }, restSec: 60 },
  },
  endurance: {
    beginner: { sets: 2, reps: { min: 12, max: 15 }, restSec: 45 },
    intermediate: { sets: 3, reps: { min: 15, max: 20 }, restSec: 40 },
    advanced: { sets: 3, reps: { min: 15, max: 20 }, restSec: 30 },
  },
};

// Rep-range nuance doesn't transfer to isometrics, so the four goals collapse
// into two buckets here. Four near-identical columns would be a table
// pretending to encode a decision it isn't making.
const TIME_BUCKET: Record<CoachGoal, "strength" | "conditioning"> = {
  build_muscle: "strength",
  maintain: "strength",
  lose_fat: "conditioning",
  endurance: "conditioning",
};

const TIME_TABLE: Record<
  "strength" | "conditioning",
  Record<ExperienceLevel, { sets: number; durationSec: number; restSec: number }>
> = {
  strength: {
    beginner: { sets: 2, durationSec: 30, restSec: 45 },
    intermediate: { sets: 3, durationSec: 45, restSec: 45 },
    advanced: { sets: 3, durationSec: 60, restSec: 45 },
  },
  conditioning: {
    beginner: { sets: 3, durationSec: 30, restSec: 30 },
    intermediate: { sets: 3, durationSec: 45, restSec: 25 },
    advanced: { sets: 3, durationSec: 60, restSec: 20 },
  },
};

/** A warm-up is preparation, not training volume: one easy set, no programmed rest. */
const WARMUP_REPS: Prescription = { mode: "reps", sets: 1, reps: { min: 8, max: 10 }, restSec: 0 };
const WARMUP_TIME: Prescription = { mode: "time", sets: 1, durationSec: 30, restSec: 0 };

/**
 * The single source of training volume. A total function of its inputs —
 * every (goal, experience, warmup, mode) combination resolves.
 */
export function prescribe(
  mode: EffortMode,
  isWarmup: boolean,
  ctx: PrescriptionContext
): Prescription {
  if (isWarmup) return mode === "time" ? { ...WARMUP_TIME } : { ...WARMUP_REPS };

  const base =
    mode === "time"
      ? { mode: "time" as const, ...TIME_TABLE[TIME_BUCKET[ctx.goal]][ctx.experienceLevel] }
      : { mode: "reps" as const, ...REP_TABLE[ctx.goal][ctx.experienceLevel] };

  if (!ctx.deload) return base;

  // Deload: one fewer set (floor 2) and a little more rest between them.
  return { ...base, sets: Math.max(2, base.sets - 1), restSec: base.restSec + 15 };
}

// ============================================================
// Effort-mode detection
// ============================================================

/**
 * Word-boundary patterns describing CONCEPTS — holds, locomotion, mobility —
 * not an exercise whitelist. Same philosophy as equipment-guardrail.ts:
 * exercise names multiply endlessly, the concepts behind them don't.
 *
 * Anchoring matters. A bare \bjump\b would swallow "Jump squat"; a bare \brow\b
 * would swallow "Bent-over row". Both are absent for that reason, and both
 * have regression tests.
 */
const TIME_PATTERNS: RegExp[] = [
  // isometric holds
  /\bplanks?\b/,
  /\bholds?\b/,
  /\bhollow body\b/,
  /\bwall sit\b/,
  /\bdead ?hangs?\b/,
  /\bl-?sit\b/,
  /\bisometric\b/,
  // conditioning / locomotion
  /\bhigh knees\b/,
  /\bjumping jacks?\b/,
  /\bmountain climbers?\b/,
  /\bjump ropes?\b/,
  /\bskipping\b/,
  /\bbutt kicks?\b/,
  /\bshadow ?box/,
  /\bmarch(ing)?\b/,
  /\bjog(ging)?\b/,
  /\bsprints?\b/,
  /\brunning\b/,
  /\bbrisk walk/,
  /\bcycling\b/,
  /\browing machine\b/,
  /\bcarry\b/,
  // mobility / stretching
  /\bstretch(es|ing)?\b/,
  /\bchild'?s pose\b/,
  /\bcat-?cow\b/,
  /\bdownward dog\b/,
  /\bpigeon pose\b/,
  /\bcobra pose\b/,
  /\bfoam roll/,
];

/**
 * "Plank to push-up", "plank row", "plank jack" are dynamic movements whose
 * names contain "plank". This is the heuristic's clearest false positive, so
 * it gets an explicit exclusion rather than a comment apologising for it.
 */
const DYNAMIC_PLANK = /\bplanks?\s+(to|up|row|rows|jack|jacks|walk|walks|shoulder|taps?)\b/;

/** Duration written into the free-text reps field: "45 seconds", "30s", "1:30". */
const DURATION_IN_REPS = /(\b\d+\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b|^\s*\d+:\d{2}\s*$)/i;

/** Local on purpose — coupling to exercise-library's normalizer would mean a wger alias tweak could change prescriptions. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Priority ladder, most trustworthy signal first. The model is asked for `mode`
 * directly, so everything below step 1 is fallback for when it omits the field.
 *
 * Failure modes, stated plainly: "Bear crawl" and "Crab walk" are genuinely
 * time-based but aren't in the list, so they fall through to reps. Non-English
 * or creative naming misses entirely and defaults to reps. Both fail in the
 * safe direction — a rep count on a timed movement reads oddly but the exercise
 * is still correct and still doable. That's why a heuristic is acceptable here
 * when equipment detection needed something stricter: an equipment miss writes
 * a plan the user physically cannot perform, a mode miss is cosmetic.
 */
export function detectEffortMode(raw: RawExercise): EffortMode {
  if (raw.mode === "reps" || raw.mode === "time") return raw.mode;

  if (raw.durationMin !== undefined && raw.reps === undefined) return "time";

  if (typeof raw.reps === "string" && DURATION_IN_REPS.test(raw.reps)) return "time";

  const name = normalizeName(raw.name);
  if (DYNAMIC_PLANK.test(name)) return "reps";
  if (TIME_PATTERNS.some((re) => re.test(name))) return "time";

  return "reps";
}

// ============================================================
// Display formatting
// ============================================================
// Formatters, not a persisted `display` string: baking presentation into JSONB
// means a wording change can never reach rows already written.

/** e.g. "3 × 8-12", "3 × 10", "3 × 45s", "3 × 2 min". */
export function formatPrescription(p: Prescription): string {
  if (p.mode === "time") {
    const duration =
      p.durationSec >= 120 && p.durationSec % 60 === 0 ? `${p.durationSec / 60} min` : `${p.durationSec}s`;
    return `${p.sets} × ${duration}`;
  }
  const reps = p.reps.min === p.reps.max ? `${p.reps.min}` : `${p.reps.min}-${p.reps.max}`;
  return `${p.sets} × ${reps}`;
}

/** Separate from formatPrescription so the UI can render rest as quieter text. */
export function formatRest(restSec: number): string {
  if (restSec <= 0) return "no rest";
  if (restSec >= 120 && restSec % 60 === 0) return `${restSec / 60} min rest`;
  return `${restSec}s rest`;
}

function isRepRange(value: unknown): value is RepRange {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RepRange).min === "number" &&
    typeof (value as RepRange).max === "number"
  );
}

function asPrescription(value: unknown): Prescription | null {
  if (typeof value !== "object" || value === null) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.sets !== "number" || typeof p.restSec !== "number") return null;

  if (p.mode === "time" && typeof p.durationSec === "number") {
    return { mode: "time", sets: p.sets, durationSec: p.durationSec, restSec: p.restSec };
  }
  if (p.mode === "reps" && isRepRange(p.reps)) {
    return { mode: "reps", sets: p.sets, reps: p.reps, restSec: p.restSec };
  }
  return null;
}

/**
 * Reads a display string out of an untyped JSONB exercise entry — new shape,
 * legacy shape, or garbage. This is the function standing between dirty
 * persisted data and a white screen, so it must never throw and must return
 * null rather than a half-formed string.
 *
 * Legacy rows (generated before prescriptions existed) look like
 * { name, sets: 3, reps: "8-12" }. They are read, not rewritten: no backfill
 * migration, because rewriting a past plan's numbers is rewriting history and
 * plans get archived and regenerated naturally.
 */
export function readExerciseDisplay(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;

  const prescription = asPrescription(e.prescription);
  if (prescription) return formatPrescription(prescription);

  // Legacy shapes, most specific first.
  if (typeof e.sets === "number" && typeof e.reps === "string" && e.reps.trim()) {
    return `${e.sets} × ${e.reps.trim()}`;
  }
  if (typeof e.sets === "number") return `${e.sets} ${e.sets === 1 ? "set" : "sets"}`;
  if (typeof e.durationMin === "number") return `${e.durationMin} min`;

  return null;
}

/** Rest line for an exercise entry, new shape only — legacy rows never stored it. */
export function readExerciseRest(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const prescription = asPrescription((raw as Record<string, unknown>).prescription);
  return prescription ? formatRest(prescription.restSec) : null;
}

// ============================================================
// Plan-level application
// ============================================================

/** Maps an unknown DB string to a valid union member, so a future enum value can't crash generation. */
export function parseExperienceLevel(value: unknown): ExperienceLevel {
  return value === "intermediate" || value === "advanced" || value === "beginner" ? value : "beginner";
}

export function parseGoal(value: unknown): CoachGoal {
  return value === "lose_fat" || value === "build_muscle" || value === "endurance" || value === "maintain"
    ? value
    : "maintain";
}

/**
 * How many exercises a session of a given length should hold.
 *
 * The prompt asks the model to fit the user's session length, and taking sets
 * away removes its main lever for that — so it gets this number instead and
 * adjusts exercise COUNT, which it still controls. Roughly 5 min per exercise
 * (3 sets of about a minute's work plus rest, plus transitions).
 */
export function exercisesPerSession(sessionMinutes: number): number {
  return Math.min(12, Math.max(4, Math.round(sessionMinutes / 5)));
}

/**
 * Rewrites every workout exercise in a generated plan with a deterministic
 * prescription. Non-mutating: the caller still holds `generated.plan` and the
 * equipment guardrail may have read it.
 *
 * The exercise object is REPLACED, not extended — no leftover top-level sets /
 * reps / durationMin / restSec, so there is never ambiguity about which field
 * the UI should believe.
 */
export function applyPrescriptions(plan: GeneratedPlan, ctx: PrescriptionContext): GeneratedPlan {
  return {
    ...plan,
    items: plan.items.map((item) => {
      if (item.itemType !== "workout") return item;

      const exercises: PrescribedExercise[] = item.details.exercises.map((raw) => {
        const warmup = raw.warmup === true;
        return {
          name: raw.name,
          warmup,
          prescription: prescribe(detectEffortMode(raw as RawExercise), warmup, ctx),
        };
      });

      return {
        ...item,
        // PrescribedExercise is the persisted shape, which is deliberately not
        // the same type as the model-input shape plan-schema.ts validates.
        details: { ...item.details, exercises: exercises as unknown as typeof item.details.exercises },
      };
    }),
  };
}
