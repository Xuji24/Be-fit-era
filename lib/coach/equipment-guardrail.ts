/**
 * Post-generation equipment check for AI-produced workout plans.
 *
 * The system prompt already tells the model to only use the user's available
 * equipment (see generatePlanForUser in coach-actions.ts), and that works in
 * practice — but it's steering, not enforcement. Nothing stops a future
 * generation from slipping in "barbell squat" for a bodyweight-only user, and
 * a plan like that would reach coach_plan_items unvalidated. This module is
 * the enforcement layer: it scans each exercise name for equipment signals
 * and flags any that need gear the user doesn't have.
 *
 * Deliberately keyword-based, not a maintained exercise whitelist. The AI
 * generates exercise names freely ("Bulgarian split squat", "goblet squat
 * hold", ...) — a fixed list of known-good names would miss constantly and
 * need endless upkeep. Equipment words are a much smaller, stabler
 * vocabulary: "barbell", "cable", "machine" don't multiply the way exercise
 * names do. False negatives (an equipment word we don't recognize slips
 * through) are possible; false positives on bodyweight moves are the
 * failure mode we tune against, since those would incorrectly reject a
 * perfectly good plan.
 */

export type EquipmentTag = "bodyweight" | "dumbbells" | "resistance_bands" | "pull_up_bar" | "kettlebell" | "full_gym";

interface EquipmentSignal {
  tag: Exclude<EquipmentTag, "bodyweight">;
  /** Word-boundary patterns that indicate this equipment is required. Lowercase. */
  patterns: RegExp[];
}

// Order matters only in that more specific patterns should be checked before
// generic ones where overlap exists (e.g. "cable machine" also contains
// "machine" — both map to full_gym here so it doesn't matter, but keep this
// in mind if a future tag needs disambiguation).
const SIGNALS: EquipmentSignal[] = [
  {
    tag: "dumbbells",
    patterns: [/\bdumbbell/i, /\bdb\b/i],
  },
  {
    tag: "resistance_bands",
    patterns: [/\bresistance band/i, /\bband(s)?\b/i],
  },
  {
    tag: "pull_up_bar",
    patterns: [/\bpull[\s-]?up bar/i, /\bpull[\s-]?ups?\b/i, /\bchin[\s-]?ups?\b/i, /\bhanging\b/i],
  },
  {
    tag: "kettlebell",
    patterns: [/\bkettlebell/i, /\bkb\b/i],
  },
  {
    tag: "full_gym",
    patterns: [
      /\bbarbell/i,
      /\bcable\b/i,
      /\bmachine\b/i,
      /\bsmith machine/i,
      /\blat pulldown/i,
      /\bleg press/i,
      /\bbench press/i,
      /\bsquat rack/i,
      /\btreadmill\b/i,
      /\browing machine\b/i,
      /\bex(?:ercise)? bike\b/i,
      /\bpec deck\b/i,
    ],
  },
];

export interface EquipmentViolation {
  exerciseName: string;
  /** Equipment the exercise appears to require. */
  requiredTag: EquipmentTag;
}

/** Which equipment tag (if any) an exercise name signals a requirement for. First match wins. */
function detectRequiredEquipment(exerciseName: string): EquipmentTag | null {
  for (const signal of SIGNALS) {
    if (signal.patterns.some((p) => p.test(exerciseName))) return signal.tag;
  }
  return null;
}

/**
 * Checks a set of exercise names against the user's available equipment.
 * Returns the exercises that require gear the user doesn't have — empty
 * array means the plan is clean.
 */
export function findEquipmentViolations(exerciseNames: string[], available: string[]): EquipmentViolation[] {
  const have = new Set(available.length > 0 ? available : ["bodyweight"]);
  // full_gym access covers everything else — a user with a full gym can do
  // dumbbell/band/kettlebell work too.
  const hasFullGym = have.has("full_gym");

  const violations: EquipmentViolation[] = [];
  for (const name of exerciseNames) {
    const required = detectRequiredEquipment(name);
    if (!required) continue; // No equipment signal detected — treat as bodyweight-safe.
    if (hasFullGym) continue;
    if (have.has(required)) continue;
    violations.push({ exerciseName: name, requiredTag: required });
  }
  return violations;
}

/** Formats violations into a single line to feed back to the model for a corrective retry. */
export function describeViolationsForRetry(violations: EquipmentViolation[], available: string[]): string {
  const have = available.length > 0 ? available.join(", ") : "bodyweight only";
  const list = violations.map((v) => `"${v.exerciseName}" requires ${v.requiredTag}`).join("; ");
  return `These exercises need equipment the user does not have (available: ${have}): ${list}. Replace each with an equivalent movement using ONLY the user's available equipment.`;
}
