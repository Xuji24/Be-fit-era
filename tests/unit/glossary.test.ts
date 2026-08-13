import { describe, it, expect } from "vitest";
import { GLOSSARY, findGlossaryEntry } from "@/lib/coach/glossary";

describe("GLOSSARY data", () => {
  it("has a unique lowercase key for every entry", () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(new Set(terms).size).toBe(terms.length);
    for (const term of terms) expect(term).toBe(term.toLowerCase());
  });

  it("gives every entry a label and a non-trivial definition", () => {
    for (const entry of GLOSSARY) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.definition.trim().length).toBeGreaterThan(20);
    }
  });

  it("covers every term the planner actually renders", () => {
    // If the planner starts showing a new unit, it belongs here too.
    for (const term of ["sets", "reps", "rest", "kcal", "grams", "warm-up", "protein", "carbs", "fat"]) {
      expect(findGlossaryEntry(term)).not.toBeNull();
    }
  });

  it("does not explain jargon using the same jargon", () => {
    // "Reps" may say "repetitions"; it must not just say "reps" again.
    const reps = findGlossaryEntry("reps");
    expect(reps?.definition.toLowerCase()).toContain("repetition");
  });
});

describe("findGlossaryEntry", () => {
  it("is case- and whitespace-insensitive", () => {
    expect(findGlossaryEntry("Sets")?.term).toBe("sets");
    expect(findGlossaryEntry("  RPE  ")?.term).toBe("rpe");
  });

  it("returns null for an unknown term rather than throwing", () => {
    expect(findGlossaryEntry("supersets")).toBeNull();
    expect(findGlossaryEntry("")).toBeNull();
  });
});
