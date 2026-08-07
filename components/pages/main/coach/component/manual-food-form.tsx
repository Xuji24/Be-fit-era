"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import CustomSelect from "@/components/ui/custom-select";

const SLOT_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-[#F5F5F0] dark:bg-[#2A2A2E] text-sm text-[#1A1A1A] dark:text-white placeholder:text-[#1A1A1A]/30 dark:placeholder:text-white/20 border-0 focus:ring-2 focus:ring-[#FF5733] outline-none transition-all font-merriweather-sans";

export interface ManualFoodFormValues {
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  foodName: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface ManualFoodFormProps {
  isPending: boolean;
  onSubmit: (values: ManualFoodFormValues) => void;
}

export default function ManualFoodForm({ isPending, onSubmit }: ManualFoodFormProps) {
  const [slot, setSlot] = useState("snack");
  const [foodName, setFoodName] = useState("");
  const [grams, setGrams] = useState("");
  const [kcal, setKcal] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");

  function reset() {
    setFoodName("");
    setGrams("");
    setKcal("");
    setProteinG("");
    setCarbsG("");
    setFatG("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      slot: slot as ManualFoodFormValues["slot"],
      foodName,
      grams: parseFloat(grams) || 0,
      kcal: parseFloat(kcal) || 0,
      proteinG: parseFloat(proteinG) || 0,
      carbsG: parseFloat(carbsG) || 0,
      fatG: parseFloat(fatG) || 0,
    });
    reset();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-semibold text-[#1A1A1A] dark:text-white font-raleway">Log off-plan food</h3>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          placeholder="Food name"
          className={`${inputClass} col-span-2`}
          required
        />
        <CustomSelect value={slot} onChange={setSlot} options={SLOT_OPTIONS} size="sm" />
        <input
          type="number"
          inputMode="decimal"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          placeholder="Grams"
          className={inputClass}
          required
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <input
          type="number"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          placeholder="Kcal"
          className={inputClass}
          required
        />
        <input
          type="number"
          inputMode="decimal"
          value={proteinG}
          onChange={(e) => setProteinG(e.target.value)}
          placeholder="Protein g"
          className={inputClass}
        />
        <input
          type="number"
          inputMode="decimal"
          value={carbsG}
          onChange={(e) => setCarbsG(e.target.value)}
          placeholder="Carbs g"
          className={inputClass}
        />
        <input
          type="number"
          inputMode="decimal"
          value={fatG}
          onChange={(e) => setFatG(e.target.value)}
          placeholder="Fat g"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-6 py-2.5 rounded-xl bg-[#FF5733] hover:bg-[#E84E2E] disabled:opacity-50 text-white text-sm font-semibold font-raleway transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log food"}
      </button>
    </form>
  );
}
