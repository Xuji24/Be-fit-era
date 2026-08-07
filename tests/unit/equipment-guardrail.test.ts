import { describe, it, expect } from "vitest";
import { findEquipmentViolations, describeViolationsForRetry } from "@/lib/coach/equipment-guardrail";

describe("findEquipmentViolations", () => {
  it("passes plain bodyweight exercises for a bodyweight-only user", () => {
    const violations = findEquipmentViolations(
      ["Push-up", "Bodyweight squat", "Plank", "Walking lunge", "Mountain climbers"],
      ["bodyweight"]
    );
    expect(violations).toEqual([]);
  });

  it("flags a barbell exercise for a bodyweight-only user", () => {
    const violations = findEquipmentViolations(["Barbell back squat"], ["bodyweight"]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({ exerciseName: "Barbell back squat", requiredTag: "full_gym" });
  });

  it("flags a dumbbell exercise when the user only has bodyweight", () => {
    const violations = findEquipmentViolations(["Dumbbell shoulder press"], ["bodyweight"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].requiredTag).toBe("dumbbells");
  });

  it("allows a dumbbell exercise when the user has dumbbells", () => {
    const violations = findEquipmentViolations(["Dumbbell shoulder press"], ["dumbbells"]);
    expect(violations).toEqual([]);
  });

  it("flags a pull-up when the user has no pull-up bar", () => {
    const violations = findEquipmentViolations(["Pull-ups"], ["bodyweight", "dumbbells"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].requiredTag).toBe("pull_up_bar");
  });

  it("allows a pull-up when the user has a pull-up bar", () => {
    const violations = findEquipmentViolations(["Pull-ups"], ["pull_up_bar"]);
    expect(violations).toEqual([]);
  });

  it("flags a kettlebell swing for a user without a kettlebell", () => {
    const violations = findEquipmentViolations(["Kettlebell swing"], ["bodyweight"]);
    expect(violations[0].requiredTag).toBe("kettlebell");
  });

  it("flags a resistance band exercise when the user lacks bands", () => {
    const violations = findEquipmentViolations(["Band pull-apart"], ["bodyweight"]);
    expect(violations[0].requiredTag).toBe("resistance_bands");
  });

  it("full_gym access clears every other equipment requirement", () => {
    const violations = findEquipmentViolations(
      ["Barbell deadlift", "Dumbbell row", "Kettlebell swing", "Pull-ups", "Band pull-apart"],
      ["full_gym"]
    );
    expect(violations).toEqual([]);
  });

  it("treats an empty equipment list as bodyweight-only", () => {
    const violations = findEquipmentViolations(["Dumbbell curl"], []);
    expect(violations).toHaveLength(1);
  });

  it("does not flag exercises whose names merely contain an unrelated substring", () => {
    // "band" must not fire on words that merely contain the letters — the
    // word-boundary regex is what prevents this.
    const violations = findEquipmentViolations(["Standing hamstring stretch"], ["bodyweight"]);
    expect(violations).toEqual([]);
  });

  it("is case-insensitive", () => {
    const violations = findEquipmentViolations(["BARBELL SQUAT"], ["bodyweight"]);
    expect(violations).toHaveLength(1);
  });

  it("flags machine-based gym equipment", () => {
    const violations = findEquipmentViolations(["Leg press", "Lat pulldown", "Cable row"], ["bodyweight"]);
    expect(violations).toHaveLength(3);
    expect(violations.every((v) => v.requiredTag === "full_gym")).toBe(true);
  });

  it("checks multiple exercises independently and only reports the mismatched ones", () => {
    const violations = findEquipmentViolations(
      ["Push-up", "Barbell bench press", "Plank", "Dumbbell row"],
      ["dumbbells"]
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].exerciseName).toBe("Barbell bench press");
  });
});

describe("describeViolationsForRetry", () => {
  it("summarizes violations with the user's actual equipment for context", () => {
    const violations = findEquipmentViolations(["Barbell squat"], ["bodyweight", "dumbbells"]);
    const message = describeViolationsForRetry(violations, ["bodyweight", "dumbbells"]);
    expect(message).toContain("Barbell squat");
    expect(message).toContain("full_gym");
    expect(message).toContain("bodyweight, dumbbells");
  });

  it("says 'bodyweight only' when the user listed no equipment", () => {
    const violations = findEquipmentViolations(["Barbell squat"], []);
    const message = describeViolationsForRetry(violations, []);
    expect(message).toContain("bodyweight only");
  });
});
