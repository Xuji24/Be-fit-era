"use client";

export const BODY_SHAPES = ["slim", "average", "athletic", "heavier"] as const;
export type BodyShape = (typeof BODY_SHAPES)[number];

const LABELS: Record<BodyShape, string> = {
  slim: "Slim",
  average: "Average",
  athletic: "Athletic",
  heavier: "Heavier",
};

/**
 * Silhouette widths per shape, in SVG units. Shoulders and waist move
 * independently so "athletic" reads as broader up top with a narrower middle,
 * rather than just a uniformly wider figure.
 */
const PROPORTIONS: Record<BodyShape, { shoulder: number; chest: number; waist: number; hip: number; thigh: number }> = {
  slim: { shoulder: 14, chest: 13, waist: 11, hip: 12.5, thigh: 5.5 },
  average: { shoulder: 17.5, chest: 17, waist: 15, hip: 16.5, thigh: 7.5 },
  athletic: { shoulder: 24, chest: 21, waist: 13.5, hip: 17, thigh: 9.5 },
  heavier: { shoulder: 20, chest: 23, waist: 24.5, hip: 23.5, thigh: 11 },
};

interface SilhouetteProps {
  shape: BodyShape;
  /** Female silhouettes carry a narrower shoulder and fuller hip. */
  sex: "male" | "female";
  selected: boolean;
}

function Silhouette({ shape, sex, selected }: SilhouetteProps) {
  const p = PROPORTIONS[shape];

  // Sex only nudges the existing proportions; it does not swap in a different
  // body plan. Keeps the four shapes readable as the same scale across sexes.
  const shoulder = sex === "female" ? p.shoulder * 0.9 : p.shoulder;
  const hip = sex === "female" ? p.hip * 1.1 : p.hip;
  const waist = sex === "female" ? p.waist * 0.95 : p.waist;

  const cx = 50;
  const fill = selected ? "var(--brand)" : "currentColor";

  return (
    <svg
      viewBox="0 0 100 150"
      className={`w-full h-auto ${selected ? "" : "text-foreground/25"}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* Head */}
      <circle cx={cx} cy={16} r={9} fill={fill} />

      {/* Torso: shoulders -> chest -> waist -> hips */}
      <path
        d={[
          `M ${cx - shoulder} 32`,
          `C ${cx - p.chest} 45, ${cx - waist} 55, ${cx - waist} 68`,
          `C ${cx - waist} 78, ${cx - hip} 82, ${cx - hip} 92`,
          `L ${cx + hip} 92`,
          `C ${cx + hip} 82, ${cx + waist} 78, ${cx + waist} 68`,
          `C ${cx + waist} 55, ${cx + p.chest} 45, ${cx + shoulder} 32`,
          "Z",
        ].join(" ")}
        fill={fill}
      />

      {/* Arms */}
      <path
        d={`M ${cx - shoulder - 1} 34 C ${cx - shoulder - 6} 50, ${cx - shoulder - 6} 66, ${cx - shoulder - 3} 80 L ${cx - shoulder + 3} 79 C ${cx - shoulder} 65, ${cx - shoulder} 50, ${cx - shoulder + 5} 37 Z`}
        fill={fill}
      />
      <path
        d={`M ${cx + shoulder + 1} 34 C ${cx + shoulder + 6} 50, ${cx + shoulder + 6} 66, ${cx + shoulder + 3} 80 L ${cx + shoulder - 3} 79 C ${cx + shoulder} 65, ${cx + shoulder} 50, ${cx + shoulder - 5} 37 Z`}
        fill={fill}
      />

      {/* Legs */}
      <path
        d={`M ${cx - hip + 1} 92 L ${cx - 1.5} 92 L ${cx - 2.5} 140 L ${cx - p.thigh - 1.5} 140 Z`}
        fill={fill}
      />
      <path
        d={`M ${cx + hip - 1} 92 L ${cx + 1.5} 92 L ${cx + 2.5} 140 L ${cx + p.thigh + 1.5} 140 Z`}
        fill={fill}
      />
    </svg>
  );
}

interface BodyShapeSelectorProps {
  value: BodyShape | null;
  onChange: (shape: BodyShape) => void;
  sex: "male" | "female";
  /** Accessible group label, e.g. "Current build". */
  legend: string;
}

export default function BodyShapeSelector({ value, onChange, sex, legend }: BodyShapeSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {BODY_SHAPES.map((shape) => {
          const selected = value === shape;
          return (
            <button
              key={shape}
              type="button"
              onClick={() => onChange(shape)}
              aria-pressed={selected}
              aria-label={LABELS[shape]}
              className={`rounded-xl px-2 pt-3 pb-2 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                selected
                  ? "bg-[var(--brand)]/15 ring-2 ring-[var(--brand)]"
                  : "bg-[var(--surface-muted)] dark:bg-[#2A2A2E] ring-1 ring-transparent hover:ring-[var(--brand)]/30"
              }`}
            >
              <div className="w-full max-w-14">
                <Silhouette shape={shape} sex={sex} selected={selected} />
              </div>
              <span
                className={`text-xs font-semibold font-raleway ${
                  selected ? "text-[var(--brand-hover)]" : "text-foreground/60"
                }`}
              >
                {LABELS[shape]}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
