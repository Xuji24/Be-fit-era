/**
 * Plain-language definitions for the jargon the planner puts on screen.
 *
 * The coach's system prompt already tells the model to "use plain, everyday
 * words — explain like the person has no fitness or nutrition background".
 * The planner UI was quietly breaking that promise by rendering "3 × 8-12",
 * "restSec" and "kcal" with no way to ask what they mean. These definitions
 * hold the same voice: short, concrete, no jargon inside the explanation of
 * the jargon.
 *
 * Data only, so it unit-tests without mounting anything.
 */

export interface GlossaryEntry {
  /** Lowercase lookup key. */
  term: string;
  /** How it appears in the UI heading. */
  label: string;
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "sets",
    label: "Sets",
    definition:
      "A set is one round of an exercise. \"3 sets\" means you do the exercise, rest, and repeat until you have done it three times.",
  },
  {
    term: "reps",
    label: "Reps",
    definition:
      "Short for repetitions — how many times you do the movement in one set. \"8-12\" means aim for at least 8, and stop by 12. If 12 still feels easy, the exercise is too light.",
  },
  {
    term: "rest",
    label: "Rest",
    definition:
      "How long to pause between sets before starting the next one. Resting is part of the workout, not a break from it — it lets you do the next set properly.",
  },
  {
    term: "warm-up",
    label: "Warm-up",
    definition:
      "Easy movements done first to get your muscles warm and ready. They are not meant to tire you out, so they are only one light set with no rest after.",
  },
  {
    term: "kcal",
    label: "Calories (kcal)",
    definition:
      "A measure of the energy in food. Your daily target is the amount that matches your goal — eating well under or over it is what moves your weight.",
  },
  {
    term: "grams",
    label: "Grams (g)",
    definition:
      "A unit of weight for food. The gram amount next to an ingredient is how much of it to use — a kitchen scale is the easiest way to be accurate at first.",
  },
  {
    term: "protein",
    label: "Protein",
    definition:
      "The nutrient your body uses to repair and build muscle. Eggs, chicken, fish, tofu, and beans are common sources.",
  },
  {
    term: "carbs",
    label: "Carbs",
    definition:
      "Short for carbohydrates — your body's main source of quick energy. Rice, bread, oats, and fruit are common sources.",
  },
  {
    term: "fat",
    label: "Fat",
    definition:
      "A nutrient your body needs for hormones and absorbing vitamins. Cooking oil, nuts, eggs, and fatty fish are common sources.",
  },
  {
    term: "progressive overload",
    label: "Progressive overload",
    definition:
      "Slowly asking your body to do a little more than last time — one more rep, a bit more weight, or less rest. It is what makes you get stronger instead of staying the same.",
  },
  {
    term: "rpe",
    label: "RPE",
    definition:
      "Rate of perceived exertion — a 1 to 10 scale for how hard a set felt. 10 means you could not do one more rep; most training should sit around 6 to 8.",
  },
  {
    term: "deload",
    label: "Deload",
    definition:
      "A planned easier week — less weight or fewer sets — taken before tiredness builds up. It lets your joints catch up so you come back stronger.",
  },
];

const BY_TERM = new Map<string, GlossaryEntry>(GLOSSARY.map((e) => [e.term, e]));

/** Looks up a definition. Case-insensitive; returns null for unknown terms. */
export function findGlossaryEntry(term: string): GlossaryEntry | null {
  return BY_TERM.get(term.trim().toLowerCase()) ?? null;
}
