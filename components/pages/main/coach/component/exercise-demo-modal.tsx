"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { getExerciseDemo, type ExerciseDemo } from "@/app/actions/coach-exercise-actions";

interface ExerciseDemoModalProps {
  exerciseName: string | null;
  onClose: () => void;
}

/**
 * Shows a real demonstration photo + numbered steps for an exercise, sourced
 * from wger.de's public exercise database (see coach-exercise-actions.ts).
 * Only exercises in our curated library (lib/coach/exercise-library.ts) have
 * a match — anything else falls back to a plain "no demo available" state
 * rather than guessing.
 */
interface FetchState {
  /** Which exerciseName this result belongs to — lets "loading" be derived
      (result hasn't caught up to the current prop yet) instead of tracked
      as separate state set inside the effect. */
  forExercise: string;
  demo: ExerciseDemo | null;
}

export default function ExerciseDemoModal({ exerciseName, onClose }: ExerciseDemoModalProps) {
  const [result, setResult] = useState<FetchState | null>(null);

  useEffect(() => {
    if (!exerciseName) return;

    let cancelled = false;
    getExerciseDemo(exerciseName).then((demo) => {
      if (!cancelled) setResult({ forExercise: exerciseName, demo });
    });

    return () => {
      cancelled = true;
    };
  }, [exerciseName]);

  const loading = exerciseName !== null && result?.forExercise !== exerciseName;
  const demo = result?.forExercise === exerciseName ? result.demo : null;
  const notFound = !loading && result?.forExercise === exerciseName && result.demo === null;

  useEffect(() => {
    if (!exerciseName) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [exerciseName, onClose]);

  if (!exerciseName) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={exerciseName}
        className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 dark:border-white/5">
          <h2 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway truncate">
            {demo?.name ?? exerciseName}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#1A1A1A]/40 dark:text-white/40 hover:text-[#FF5733] hover:bg-[#FF5733]/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#FF5733]" />
            </div>
          )}

          {notFound && !loading && (
            <p className="px-5 py-10 text-center text-sm text-[#1A1A1A]/50 dark:text-white/50 font-merriweather-sans">
              No demo available for this exercise yet.
            </p>
          )}

          {demo && !loading && (
            <>
              {demo.imageUrl && (
                // wger-hosted images are external and user-agnostic reference
                // photos, not something worth Next/Image optimizing for.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={demo.imageUrl} alt={demo.name} className="w-full bg-[#F5F5F0] dark:bg-[#2A2A2E]" />
              )}
              {demo.steps.length > 0 && (
                <ol className="px-5 py-4 space-y-2.5 list-decimal list-inside">
                  {demo.steps.map((step, i) => (
                    <li key={i} className="text-sm text-[#1A1A1A] dark:text-white font-merriweather-sans">
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
