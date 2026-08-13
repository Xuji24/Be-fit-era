import { describe, it, expect } from "vitest";
import { checkGoalProgress } from "@/lib/coach/goals";

describe("checkGoalProgress", () => {
  describe("weight-loss direction (target below initial)", () => {
    it("is not reached while still above target", () => {
      expect(checkGoalProgress(80, 70, 75)).toBe(false);
    });

    it("is reached exactly at target", () => {
      expect(checkGoalProgress(80, 70, 70)).toBe(true);
    });

    it("is reached below target", () => {
      expect(checkGoalProgress(80, 70, 68)).toBe(true);
    });
  });

  describe("weight-gain direction (target above initial)", () => {
    it("is not reached while still below target", () => {
      expect(checkGoalProgress(60, 70, 65)).toBe(false);
    });

    it("is reached exactly at target", () => {
      expect(checkGoalProgress(60, 70, 70)).toBe(true);
    });

    it("is reached above target", () => {
      expect(checkGoalProgress(60, 70, 72)).toBe(true);
    });
  });

  describe("degenerate case: target equals initial weight", () => {
    it("is reached only on an exact match, not on every check-in", () => {
      expect(checkGoalProgress(70, 70, 70)).toBe(true);
      expect(checkGoalProgress(70, 70, 69)).toBe(false);
      expect(checkGoalProgress(70, 70, 71)).toBe(false);
    });
  });
});
