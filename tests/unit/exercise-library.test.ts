import { describe, it, expect } from "vitest";
import { findWgerId } from "@/lib/coach/exercise-library";

describe("findWgerId — original entries", () => {
  it("matches squat variants", () => {
    expect(findWgerId("Squat")).toBe(1963);
    expect(findWgerId("bodyweight squat")).toBe(1963);
  });

  it("matches push-up variants", () => {
    expect(findWgerId("Push-Up")).toBe(1551);
    expect(findWgerId("push ups")).toBe(1551);
  });
});

describe("findWgerId — newly added entries", () => {
  it("matches jumping jack variants", () => {
    expect(findWgerId("Jumping Jack")).toBe(320);
    expect(findWgerId("jumping jacks")).toBe(320);
    expect(findWgerId("Star Jumps")).toBe(320);
  });

  it("matches bird dog variants", () => {
    expect(findWgerId("Bird Dog")).toBe(1572);
    expect(findWgerId("bird-dog")).toBe(1572);
  });

  it("matches high knee variants", () => {
    expect(findWgerId("High Knees")).toBe(983);
    expect(findWgerId("high knee run")).toBe(983);
  });

  it("matches reverse lunge as a distinct entry from plain lunge", () => {
    expect(findWgerId("Reverse Lunge")).toBe(999);
    expect(findWgerId("Lunge")).toBe(984);
    expect(findWgerId("Reverse Lunge")).not.toBe(findWgerId("Lunge"));
  });

  it("matches child's pose with and without the apostrophe", () => {
    expect(findWgerId("Child's Pose")).toBe(1002);
    expect(findWgerId("Childs Pose")).toBe(1002);
  });
});

describe("findWgerId — normalization and misses", () => {
  it("is case-insensitive", () => {
    expect(findWgerId("JUMPING JACKS")).toBe(320);
  });

  it("strips parenthetical asides before matching", () => {
    expect(findWgerId("High Knees (fast pace)")).toBe(983);
  });

  it("returns null for anything not in the curated table", () => {
    expect(findWgerId("Bulgarian split squat")).toBeNull();
    expect(findWgerId("Turkish get-up")).toBeNull();
  });
});
