import { describe, it, expect } from "vitest";
import { findAnimationId, isUnilateral } from "@/lib/coach/exercise-animations";

describe("findAnimationId — kept animations", () => {
  it("matches squat variants", () => {
    expect(findAnimationId("Squat")).toBe("squat");
    expect(findAnimationId("Goblet squat")).toBe("squat");
    expect(findAnimationId("Air squats")).toBe("squat");
  });

  it("matches lunge variants, including split squats", () => {
    expect(findAnimationId("Lunges")).toBe("lunge");
    expect(findAnimationId("Reverse lunge")).toBe("lunge");
    // A split squat is the same movement pattern to a viewer, so it shares
    // the lunge animation rather than falling through to no visual.
    expect(findAnimationId("Bulgarian split squat")).toBe("lunge");
  });

  it("matches calf raise variants", () => {
    expect(findAnimationId("Calf raises")).toBe("calf-raise");
    expect(findAnimationId("Single leg calf raise")).toBe("calf-raise");
  });

  it("matches high knees variants", () => {
    expect(findAnimationId("High knees")).toBe("high-knees");
    expect(findAnimationId("Knee drive")).toBe("high-knees");
  });

  it("matches glute bridge variants", () => {
    expect(findAnimationId("Glute bridge")).toBe("glute-bridge");
    expect(findAnimationId("Hip thrust")).toBe("glute-bridge");
  });
});

describe("findAnimationId — new running-focused animations", () => {
  it("matches step-up variants", () => {
    expect(findAnimationId("Step-up")).toBe("step-up");
    expect(findAnimationId("Step ups")).toBe("step-up");
    expect(findAnimationId("Box step-up")).toBe("step-up");
  });

  it("matches single-leg RDL variants", () => {
    expect(findAnimationId("Single-leg RDL")).toBe("single-leg-rdl");
    expect(findAnimationId("Single leg Romanian deadlift")).toBe("single-leg-rdl");
    expect(findAnimationId("One-leg RDL")).toBe("single-leg-rdl");
  });

  it("matches lateral band walk variants", () => {
    expect(findAnimationId("Lateral band walk")).toBe("lateral-band-walk");
    expect(findAnimationId("Monster walks")).toBe("lateral-band-walk");
    expect(findAnimationId("Banded lateral walk")).toBe("lateral-band-walk");
  });
});

describe("findAnimationId — matching discipline", () => {
  it("normalizes case and parentheticals", () => {
    expect(findAnimationId("SQUAT")).toBe("squat");
    expect(findAnimationId("  Lunges  ")).toBe("lunge");
    expect(findAnimationId("Step-up (weighted)")).toBe("step-up");
  });

  it("keeps distinct movements on distinct animations", () => {
    expect(findAnimationId("Squat")).not.toBe(findAnimationId("Lunge"));
    expect(findAnimationId("Step-up")).not.toBe(findAnimationId("Single-leg RDL"));
  });

  it("returns null rather than guessing at an unmapped exercise", () => {
    // Showing the wrong animation is worse than showing none — the modal has
    // a photo and a static-pose fallback for exactly this case. This also
    // covers the generic gym movements dropped from this coach's scope.
    for (const name of ["Deadlift", "Bench press", "Bent-over row", "Shoulder press", "Push-up", "Plank", ""]) {
      expect(findAnimationId(name)).toBeNull();
    }
  });

  it("does not match a substring of an unrelated exercise", () => {
    expect(findAnimationId("Squat jump to box")).toBeNull();
  });
});

describe("isUnilateral", () => {
  it("flags lunge, step-up, and single-leg RDL as per-leg exercises", () => {
    expect(isUnilateral("lunge")).toBe(true);
    expect(isUnilateral("step-up")).toBe(true);
    expect(isUnilateral("single-leg-rdl")).toBe(true);
  });

  it("does not flag two-legged or non-leg-counted exercises", () => {
    expect(isUnilateral("squat")).toBe(false);
    expect(isUnilateral("calf-raise")).toBe(false);
    expect(isUnilateral("glute-bridge")).toBe(false);
    expect(isUnilateral("high-knees")).toBe(false);
    expect(isUnilateral("lateral-band-walk")).toBe(false);
  });

  it("returns false for no animation rather than throwing", () => {
    expect(isUnilateral(null)).toBe(false);
  });
});
