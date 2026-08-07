"use server";

import { findWgerId } from "@/lib/coach/exercise-library";

const WGER_API = "https://wger.de/api/v2";

export interface ExerciseDemo {
  name: string;
  imageUrl: string | null;
  /** Numbered steps, split from wger's instruction text. */
  steps: string[];
}

interface WgerTranslation {
  language: number;
  name: string;
  description_source?: string;
}

interface WgerImage {
  image: string;
  is_main: boolean;
}

interface WgerExerciseInfo {
  images?: WgerImage[];
  translations?: WgerTranslation[];
}

const ENGLISH_LANGUAGE_ID = 2;

/**
 * Splits wger's free-text instructions into steps. Most entries write
 * "1. Do this\n2. Do that"; this also copes with entries that just wrote
 * plain sentences with no numbering, falling back to one step per sentence.
 */
function splitSteps(text: string): string[] {
  const numbered = text
    .split(/\n?\s*\d+\.\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fetches a real demonstration image + step-by-step instructions for an
 * AI-generated exercise name, if it's in our curated library
 * (lib/coach/exercise-library.ts). Returns null for anything unmapped —
 * showing no visual is correct here; showing a mismatched one is not.
 */
export async function getExerciseDemo(exerciseName: string): Promise<ExerciseDemo | null> {
  const wgerId = findWgerId(exerciseName);
  if (!wgerId) return null;

  let data: WgerExerciseInfo;
  try {
    const res = await fetch(`${WGER_API}/exerciseinfo/${wgerId}/?language=${ENGLISH_LANGUAGE_ID}`, {
      next: { revalidate: 60 * 60 * 24 }, // exercise reference data changes rarely
    });
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }

  const translation = data.translations?.find((t) => t.language === ENGLISH_LANGUAGE_ID);
  if (!translation) return null;

  const mainImage = data.images?.find((img) => img.is_main) ?? data.images?.[0];
  const description = translation.description_source ?? "";

  return {
    name: translation.name,
    imageUrl: mainImage?.image ?? null,
    steps: description ? splitSteps(description) : [],
  };
}
