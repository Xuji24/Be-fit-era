/**
 * Maps AI-generated exercise names to one of the hand-drawn animations in
 * components/pages/main/coach/component/exercise-rig.tsx.
 *
 * Deliberately curated rather than fuzzy, same reasoning as
 * exercise-library.ts: the model names exercises freely, and a wrong-but-
 * confident match (showing a squat for a deadlift) is worse than no match —
 * the demo modal falls back to a photo, then a static pose, so a miss here
 * is cheap.
 *
 * The animation set is narrow and running-focused (knee/leg/calf/hamstring
 * injury prevention and strength work) — see exercise-poses.ts's header
 * comment for why a generic gym set was dropped.
 */

import type { ExerciseAnimationId } from "@/components/pages/main/coach/component/exercise-rig";

interface AnimationEntry {
  id: ExerciseAnimationId;
  /** Clean display form for prompts and UI text — not necessarily aliases[0],
   *  which is optimized for matching, not reading ("single leg rdl" matches
   *  fine but reads worse than "single-leg RDL"). */
  label: string;
  /** Equipment this movement needs beyond bodyweight, in prompt-ready form —
   *  null for anything doable with nothing. Single source for the AI
   *  system prompt's equipment caveat, so a newly-added exercise can't
   *  silently go unmentioned there the way kettlebell swing initially did. */
  equipmentNote: string | null;
  /** Names/synonyms that resolve to this animation, all lowercase. */
  aliases: string[];
}

const ANIMATIONS: AnimationEntry[] = [
  {
    id: "squat",
    label: "squat",
    equipmentNote: null,
    aliases: [
      "squat", "squats", "bodyweight squat", "bodyweight squats", "air squat", "air squats",
      "basic squat", "goblet squat", "goblet squats", "chair squat", "chair squats",
      "sumo squat", "sumo squats", "prisoner squat", "wall squat",
    ],
  },
  {
    id: "lunge",
    label: "lunge",
    equipmentNote: null,
    aliases: [
      "lunge", "lunges", "forward lunge", "forward lunges", "walking lunge", "walking lunges",
      "reverse lunge", "reverse lunges", "backward lunge", "backward lunges",
      "static lunge", "split squat", "split squats", "bulgarian split squat",
      "knee lunge",
    ],
  },
  {
    id: "calf-raise",
    label: "calf raise",
    equipmentNote: null,
    aliases: [
      "calf raise", "calf raises", "standing calf raise", "standing calf raises",
      "heel raise", "heel raises", "toe raise", "toe raises", "single leg calf raise",
    ],
  },
  {
    id: "high-knees",
    label: "high knees",
    equipmentNote: null,
    aliases: [
      "high knee", "high knees", "high knee run", "high knee runs", "running in place",
      "jog in place", "jogging in place", "knee drive", "knee drives",
    ],
  },
  {
    id: "glute-bridge",
    label: "glute bridge",
    equipmentNote: null,
    aliases: [
      "glute bridge", "glute bridges", "hip bridge", "hip bridges", "bridge", "bridges",
      "hip thrust", "hip thrusts", "single leg glute bridge",
    ],
  },
  {
    id: "step-up",
    label: "step-up",
    equipmentNote: "needs a sturdy step, bench, or box",
    aliases: [
      "step-up", "step up", "stepup", "step-ups", "step ups", "stepups",
      "box step-up", "box step up", "bench step-up", "bench step up",
      "lateral step-up", "lateral step up",
    ],
  },
  {
    id: "single-leg-rdl",
    label: "single-leg RDL",
    equipmentNote: null,
    aliases: [
      "single-leg rdl", "single leg rdl", "single-leg romanian deadlift",
      "single leg romanian deadlift", "one leg rdl", "one-leg rdl",
      "single leg deadlift", "single-leg deadlift", "unilateral rdl",
    ],
  },
  {
    id: "lateral-band-walk",
    label: "lateral band walk",
    equipmentNote: "needs a resistance band",
    aliases: [
      "lateral band walk", "lateral band walks", "band walk", "band walks",
      "monster walk", "monster walks", "side step with band", "banded lateral walk",
      "banded side step", "lateral walk",
    ],
  },
  {
    id: "kettlebell-swing",
    label: "kettlebell swing",
    equipmentNote: "needs a kettlebell",
    aliases: [
      "kettlebell swing", "kettlebell swings", "kb swing", "kb swings",
      "russian kettlebell swing", "russian swing", "two-hand kettlebell swing",
      "two hand kettlebell swing", "two-arm kettlebell swing",
    ],
  },
];

const ALIAS_TO_ANIMATION = new Map<string, ExerciseAnimationId>();
for (const entry of ANIMATIONS) {
  for (const alias of entry.aliases) {
    ALIAS_TO_ANIMATION.set(alias, entry.id);
  }
}

/**
 * How many distinct exercises the AI can actually choose between.
 *
 * This is the number a session's exercise COUNT must never exceed — the bug
 * that caused it (coach-actions.ts's system prompt asking for up to 12
 * exercises from what was, at the time, an 8-item hardcoded vocabulary
 * sentence disconnected from this file) is exactly the class of bug this
 * export exists to make impossible: whatever grows this list automatically
 * raises the cap with it, so the two can't drift apart again.
 */
export const ANIMATION_VOCABULARY_SIZE = ANIMATIONS.length;

/**
 * Builds the AI system prompt's exercise-vocabulary sentence from the same
 * data `findAnimationId` matches against, instead of a hand-typed sentence
 * that has to be remembered every time an exercise is added. Equipment
 * caveats are folded in per-exercise so a new exercise that needs gear
 * (like the kettlebell swing) can't go unmentioned the way it initially did.
 */
export function describeAnimationVocabularyForPrompt(): string {
  return ANIMATIONS.map((a) => (a.equipmentNote ? `${a.label} (${a.equipmentNote})` : a.label)).join(", ");
}

/**
 * Exercises where the prescribed reps happen once per leg, not once per set —
 * a "3 × 10" on a single-leg RDL means 10 per leg, and the planner should say
 * so rather than leaving it ambiguous.
 */
const UNILATERAL_EXERCISES: ReadonlySet<ExerciseAnimationId> = new Set([
  "lunge", "step-up", "single-leg-rdl",
]);

export function isUnilateral(animationId: ExerciseAnimationId | null): boolean {
  return animationId !== null && UNILATERAL_EXERCISES.has(animationId);
}

/**
 * Lowercase, drop parenthetical asides ("Squat (bodyweight)" -> "squat"), and
 * collapse whitespace. Kept local rather than shared with exercise-library.ts:
 * they answer different questions, and coupling them would mean a wger alias
 * tweak could silently change which animation plays.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolves an exercise name to an animation, or null when we have none for it. */
export function findAnimationId(exerciseName: string): ExerciseAnimationId | null {
  return ALIAS_TO_ANIMATION.get(normalize(exerciseName)) ?? null;
}
