"use client";

import { useState } from "react";
import ExerciseDemoModal from "@/components/pages/main/coach/component/exercise-demo-modal";

/**
 * One name per animation in lib/coach/exercise-poses.ts, plus deliberate misses,
 * so this harness exercises all tiers of the demo modal's fallback: 3D model,
 * 2D animation, wger photo, then the neutral placeholder figure. The set is
 * the running-focused vocabulary in lib/coach/exercise-poses.ts.
 */
const TEST_NAMES = [
  "Squat",
  "Lunges",
  "Calf raises",
  "High knees",
  "Glute bridge",
  "Step-up",
  "Single-leg RDL",
  "Lateral band walk",
  // No animation, but in the wger library -> photo + steps.
  "Bird dog",
  // In neither table -> placeholder figure.
  "Tricep Dips (using a chair)",
];

export default function ExercisePreviewPage() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background pt-28 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-2xl font-bold text-foreground font-raleway mb-8">Exercise Demo Preview</h1>
        <div className="flex flex-wrap gap-3">
          {TEST_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 shadow-sm text-sm font-merriweather-sans text-foreground hover:border-[var(--brand)]/30 transition-colors cursor-pointer"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <ExerciseDemoModal exerciseName={active} onClose={() => setActive(null)} />
    </div>
  );
}
