"use client";

import { useState } from "react";
import ExerciseDemoModal from "@/components/pages/main/coach/component/exercise-demo-modal";

const TEST_NAMES = ["Squat", "Push-up", "Plank", "Lunges", "Tricep Dips (using a chair)"];

export default function ExercisePreviewPage() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#121212] pt-28 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A] dark:text-white font-raleway mb-8">Exercise Demo Preview</h1>
        <div className="flex flex-wrap gap-3">
          {TEST_NAMES.map((name) => (
            <button
              key={name}
              onClick={() => setActive(name)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 shadow-sm text-sm font-merriweather-sans text-[#1A1A1A] dark:text-white hover:border-[#FF5733]/30 transition-colors cursor-pointer"
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
