import type { MacroTotals } from "@/lib/coach/nutrition";
import MacroBar from "./macro-bar";

interface Target {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

interface MacroSummaryProps {
  consumed: MacroTotals;
  target: Target;
}

export default function MacroSummary({ consumed, target }: MacroSummaryProps) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 shadow-sm p-6 space-y-4">
      <MacroBar label="Calories" consumed={consumed.kcal} target={target.kcal} />
      <div className="grid grid-cols-3 gap-4">
        <MacroBar label="Protein" consumed={consumed.proteinG} target={target.proteinG} />
        <MacroBar label="Carbs" consumed={consumed.carbsG} target={target.carbsG} />
        <MacroBar label="Fat" consumed={consumed.fatG} target={target.fatG} />
      </div>
    </div>
  );
}
