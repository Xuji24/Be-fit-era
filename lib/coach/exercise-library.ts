/**
 * Curated mapping from common exercise names (and their synonyms) to wger.de
 * exercise IDs, hand-verified to have a real bodyweight/common-equipment
 * photo and correct step-by-step instructions — see the wger API:
 * https://wger.de/api/v2/exerciseinfo/{id}/?language=2
 *
 * The AI generates exercise names freely, so exact-string matching against
 * wger's own naming ("Bulgarian split squats left") would miss constantly.
 * This table is the deliberate alternative to fuzzy-matching the live API:
 * every entry here was picked and checked by hand, so a match is trustworthy.
 * Anything not in this table has no visual — better than showing a wrong one.
 */

interface ExerciseLibraryEntry {
  wgerId: number;
  /** Names/synonyms that should resolve to this entry, all lowercase. */
  aliases: string[];
}

const LIBRARY: ExerciseLibraryEntry[] = [
  { wgerId: 1963, aliases: ["squat", "squats", "bodyweight squat", "air squat", "basic squat"] },
  { wgerId: 1551, aliases: ["push-up", "push up", "pushup", "push-ups", "push ups", "pushups"] },
  { wgerId: 458, aliases: ["plank", "planks", "forearm plank", "front plank"] },
  { wgerId: 984, aliases: ["lunge", "lunges", "forward lunge", "walking lunge"] },
  { wgerId: 320, aliases: ["jumping jack", "jumping jacks", "star jump", "star jumps"] },
  { wgerId: 1572, aliases: ["bird dog", "bird-dog", "bird dogs"] },
  { wgerId: 983, aliases: ["high knee", "high knees", "high knee run", "high knee runs"] },
  { wgerId: 999, aliases: ["reverse lunge", "reverse lunges", "backward lunge", "backward lunges"] },
  { wgerId: 1002, aliases: ["child's pose", "childs pose", "child pose"] },
];

const ALIAS_TO_ID = new Map<string, number>();
for (const entry of LIBRARY) {
  for (const alias of entry.aliases) {
    ALIAS_TO_ID.set(alias, entry.wgerId);
  }
}

/**
 * Normalizes an AI-generated exercise name for matching: lowercase, strip
 * parenthetical asides ("Tricep Dips (using a chair)" -> "tricep dips") and
 * trailing qualifiers the model tends to add, so more real matches land
 * without loosening the table itself into fuzzy territory.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .trim();
}

/** Looks up a curated wger ID for an AI-generated exercise name, or null if unmapped. */
export function findWgerId(exerciseName: string): number | null {
  return ALIAS_TO_ID.get(normalize(exerciseName)) ?? null;
}
