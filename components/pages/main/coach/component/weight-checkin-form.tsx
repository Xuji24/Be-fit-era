"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans";

interface WeightCheckInFormProps {
  isPending: boolean;
  onSubmit: (weightKg: number, bodyFatPct?: number) => void;
  /** Whether this ISO week already has a weigh-in — changes the copy so
   *  logging again doesn't read as adding a second entry. */
  hasThisWeek: boolean;
}

export default function WeightCheckInForm({ isPending, onSubmit, hasThisWeek }: WeightCheckInFormProps) {
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(weightKg);
    if (!(value >= 30 && value <= 300)) return;

    const fat = bodyFatPct ? parseFloat(bodyFatPct) : undefined;
    if (fat !== undefined && !(fat >= 3 && fat <= 70)) return;

    onSubmit(value, fat);
    setWeightKg("");
    setBodyFatPct("");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">
        {hasThisWeek ? "Update this week's weigh-in" : "Log this week's weigh-in"}
      </h3>
      <div className="flex gap-3">
        <input
          type="number"
          inputMode="decimal"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="Weight (kg)"
          className={inputClass}
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 px-6 py-2.5 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] disabled:opacity-50 text-white text-sm font-semibold font-raleway transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log"}
        </button>
      </div>
      <div>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={bodyFatPct}
          onChange={(e) => setBodyFatPct(e.target.value)}
          placeholder="Body fat % — optional"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans">
          From a smart scale or calipers. Adding it turns your body-composition stats from estimates into
          measured values.
        </p>
      </div>

      <p className="text-xs text-[#1A1A1A]/40 dark:text-white/40 font-merriweather-sans">
        {hasThisWeek
          ? "Logging again replaces this week's entry."
          : "One weigh-in a week is enough to see the trend without the day-to-day noise."}
      </p>
    </form>
  );
}
