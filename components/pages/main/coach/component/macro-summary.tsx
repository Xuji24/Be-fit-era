import type { MacroTotals } from "@/lib/coach/nutrition";

interface Target {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number | null;
}

function MacroBar({ label, consumed, target }: MacroBarProps) {
  const pct = target ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const over = target !== null && consumed > target;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-xs font-semibold text-[#1A1A1A]/60 dark:text-white/60 font-merriweather-sans">{label}</p>
        <p className={`text-xs font-merriweather-sans ${over ? "text-[#FF5733] font-semibold" : "text-[#1A1A1A]/40 dark:text-white/40"}`}>
          {consumed}
          {target !== null && ` / ${target}`}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-[#1A1A1A]/5 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-[#FF5733]" : "bg-[#FF5733]/70"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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
