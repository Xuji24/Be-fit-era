/**
 * Shared recharts styling.
 *
 * Charts in this app were each styling themselves inline, and the tooltip
 * object — `backgroundColor: "rgba(255,255,255,0.9)"` with dark text — was
 * copy-pasted seven times with no dark variant. On a dark background that
 * renders a white card with near-black text: legible, but jarring, and clearly
 * unconsidered.
 *
 * Canvas/SVG inside recharts can't read Tailwind's `dark:` classes, and reading
 * CSS custom properties at render time would need a client-side effect on every
 * chart. So the approach here is the one already used (and working) in
 * bmi-trend-chart.tsx: neutral, semi-transparent greys that resolve legibly
 * against either background, plus an explicit theme-aware tooltip for the one
 * element where a flat surface is unavoidable.
 */

/** Brand orange. Duplicated from the --brand token because SVG attrs can't read CSS vars. */
export const CHART_BRAND = "#FF5733";

/**
 * Categorical series colours. Ordered so the first three read as distinct at a
 * glance for the macro split (protein / carbs / fat), which is the densest use.
 */
export const CHART_SERIES = ["#FF5733", "#3B82F6", "#FFB800", "#10B981", "#8B5CF6"] as const;

/** Semantic colours for state, kept separate from the categorical ramp. */
export const CHART_STATUS = {
  done: "#10B981",
  pending: "#FFB800",
  missed: "#EF4444",
  neutral: "rgba(128,128,128,0.25)",
} as const;

/** Gridlines and axes: one step off whatever surface they sit on, either theme. */
export const CHART_GRID_STROKE = "rgba(128,128,128,0.15)";
export const CHART_AXIS_TICK = { fill: "rgba(128,128,128,0.7)", fontSize: 11 } as const;
export const CHART_TRACK = "rgba(128,128,128,0.12)";

/**
 * Tooltip styling. A tooltip needs an opaque surface to stay readable over
 * plotted marks, so unlike the strokes above it cannot be theme-neutral —
 * `color-mix` against `Canvas`/`CanvasText` lets the browser resolve it from
 * the active colour scheme without a JS theme read.
 */
export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, Canvas 92%, transparent)",
  color: "CanvasText",
  border: "1px solid rgba(128,128,128,0.25)",
  borderRadius: 12,
  fontSize: 12,
  fontFamily: "var(--font-merriweather-sans)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
  padding: "8px 12px",
};

export const CHART_TOOLTIP_ITEM_STYLE: React.CSSProperties = {
  color: "CanvasText",
  fontSize: 12,
};

/** Applied to the page so `Canvas`/`CanvasText` above resolve to the app's theme. */
export const CHART_COLOR_SCHEME_CLASS = "[color-scheme:light] dark:[color-scheme:dark]";
