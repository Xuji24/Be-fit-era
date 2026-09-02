"use client";

export interface OptionItem {
  value: string;
  label: string;
  hint?: string;
}

interface OptionCardsProps {
  options: OptionItem[];
  /** string for single-select, string[] for multi. */
  value: string | string[];
  onChange: (value: string) => void;
  multi?: boolean;
  columns?: 1 | 2;
  legend: string;
}

/** Tappable choice cards — the wizard's single- and multi-select control. */
export default function OptionCards({
  options,
  value,
  onChange,
  multi = false,
  columns = 1,
  legend,
}: OptionCardsProps) {
  const isSelected = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);

  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        {options.map((opt) => {
          const selected = isSelected(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
              aria-label={opt.hint ? `${opt.label} — ${opt.hint}` : opt.label}
              className={`text-left px-4 py-3 rounded-xl transition-colors cursor-pointer ${
                selected
                  ? "bg-[var(--brand)]/15 ring-2 ring-[var(--brand)]"
                  : "bg-[var(--surface-muted)] dark:bg-[#2A2A2E] ring-1 ring-transparent hover:ring-[var(--brand)]/30"
              }`}
            >
              <span
                className={`block text-sm font-semibold font-raleway ${
                  selected ? "text-[var(--brand-hover)]" : "text-foreground"
                }`}
              >
                {opt.label}
              </span>
              {opt.hint && (
                <span className="block mt-0.5 text-xs text-foreground/50 font-merriweather-sans">
                  {opt.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {multi && (
        <p className="mt-2 text-xs text-foreground/40 font-merriweather-sans">
          Select all that apply.
        </p>
      )}
    </fieldset>
  );
}
