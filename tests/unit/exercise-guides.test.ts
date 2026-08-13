import { describe, it, expect } from "vitest";
import { EXERCISE_GUIDES, findExerciseGuide } from "@/lib/coach/exercise-guides";
import { findAnimationId } from "@/lib/coach/exercise-animations";

const ANIMATION_IDS = Object.keys(EXERCISE_GUIDES) as (keyof typeof EXERCISE_GUIDES)[];

describe("EXERCISE_GUIDES coverage", () => {
  // The whole point of this module: anything we can animate has words to go
  // with it, so a demo can never open with a picture and no instructions.
  it("covers every exercise the animation table can resolve", () => {
    for (const name of [
      "Squat", "Lunges", "Calf raises", "High knees", "Glute bridge",
      "Step-up", "Single-leg RDL", "Lateral band walk",
    ]) {
      const id = findAnimationId(name);
      expect(id, `${name} should map to an animation`).not.toBeNull();
      expect(findExerciseGuide(id), `${name} should have a guide`).not.toBeNull();
    }
  });

  it("gives every guide usable steps", () => {
    for (const id of ANIMATION_IDS) {
      const guide = EXERCISE_GUIDES[id];
      expect(guide.steps.length, `${id} steps`).toBeGreaterThanOrEqual(3);
      for (const step of guide.steps) {
        expect(step.trim().length, `${id} step text`).toBeGreaterThan(15);
      }
    }
  });

  it("gives every guide form cues", () => {
    for (const id of ANIMATION_IDS) {
      expect(EXERCISE_GUIDES[id].cues.length, `${id} cues`).toBeGreaterThanOrEqual(2);
    }
  });

  it("writes steps as instructions, not descriptions", () => {
    // Each step should read as something to do. A step starting "The squat is"
    // is a description that slipped in.
    for (const id of ANIMATION_IDS) {
      for (const step of EXERCISE_GUIDES[id].steps) {
        expect(step, `${id}: "${step}"`).not.toMatch(/^(this|the) (exercise|movement|squat|plank)\b/i);
      }
    }
  });

  it("keeps medical claims out of form cues", () => {
    // Form guidance only. Anything about diagnosing pain belongs in the
    // knowledge base, which carries the see-a-professional framing.
    for (const id of ANIMATION_IDS) {
      for (const cue of EXERCISE_GUIDES[id].cues) {
        expect(cue.toLowerCase(), `${id}: "${cue}"`).not.toMatch(/\b(diagnos|prescription|medication|ibuprofen)/);
      }
    }
  });
});

describe("findExerciseGuide", () => {
  it("returns the guide for a known animation id", () => {
    const guide = findExerciseGuide("glute-bridge");
    expect(guide).not.toBeNull();
    expect(guide!.steps[0]).toMatch(/back/i);
  });

  it("returns null for no animation rather than throwing", () => {
    expect(findExerciseGuide(null)).toBeNull();
  });
});
