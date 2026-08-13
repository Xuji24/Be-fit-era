/**
 * The coach's meter: a labelled value above a thin track.
 *
 * Extracted from macro-summary.tsx so the planner's day cards can show calories
 * as a meter instead of a "1380 / 2560" string, without a second implementation
 * drifting out of sync. It also picks up the `role="progressbar"` set from
 * wizard-shell.tsx, which was previously the only accessible meter in the repo —
 * a bar with no ARIA is invisible to a screen reader.
 */

interface MacroBarProps {
  label: string;
  consumed: number;
  /** Null when the user has no target for this macro — the bar renders empty. */
  target: number | null;
  /** Suffix shown after the numbers, e.g. "kcal" or "g". */
  unit?: string;
  /** Compact drops the label row's font size for dense contexts like day cards. */
  compact?: boolean;
}

export default function MacroBar({ label, consumed, target, unit, compact = false }: MacroBarProps) {
  const pct = target ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
  const over = target !== null && consumed > target;
  const labelSize = compact ? "text-[10px]" : "text-xs";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 gap-2">
        <p className={`${labelSize} font-semibold text-[#1A1A1A]/60 dark:text-white/60 font-merriweather-sans`}>
          {label}
        </p>
        <p
          className={`${labelSize} font-merriweather-sans tabular-nums shrink-0 ${
            over ? "text-[#FF5733] font-semibold" : "text-[#1A1A1A]/40 dark:text-white/40"
          }`}
        >
          {consumed}
          {target !== null && ` / ${target}`}
          {unit && ` ${unit}`}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-[#1A1A1A]/5 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-[#FF5733]" : "bg-[#FF5733]/70"}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={consumed}
          aria-valuemin={0}
          aria-valuemax={target ?? consumed}
          aria-label={`${label}: ${consumed}${target !== null ? ` of ${target}` : ""}${unit ? ` ${unit}` : ""}`}
        />
      </div>
    </div>
  );
}
