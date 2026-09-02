"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Dumbbell, Loader2, Moon, Utensils } from "lucide-react";
import type { PlanItemRow } from "@/app/actions/coach-actions";
import { readExerciseDisplay, readExerciseRest } from "@/lib/coach/prescription";
import { findAnimationId, isUnilateral } from "@/lib/coach/exercise-animations";
import ExerciseDemoModal from "./exercise-demo-modal";
import GlossaryHint from "./glossary-hint";
import MacroBar from "./macro-bar";

const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  am: "Morning",
  pm: "Evening",
};

const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3, am: 0, pm: 1 };

interface ExerciseView {
  name: string;
  /** e.g. "3 × 8-12" or "3 × 45s", with " each leg" appended for unilateral exercises. Null for rows too old or malformed to read. */
  display: string | null;
  rest: string | null;
}

/**
 * details.exercises[] is untyped JSONB on the way in — narrow it defensively at
 * the boundary. The display/rest readers tolerate both the current prescription
 * shape and the pre-prescription rows still in the database, and never throw.
 */
function getExercises(details: Record<string, unknown>): ExerciseView[] {
  const exercises = details.exercises;
  if (!Array.isArray(exercises)) return [];

  return exercises
    .map((e) => {
      if (!e || typeof e !== "object") return null;
      const name = (e as { name?: unknown }).name;
      if (typeof name !== "string") return null;
      const display = readExerciseDisplay(e);
      // "3 × 10" on a single-leg RDL means 10 per leg — say so, rather than
      // leaving a genuine ambiguity in the prescription (lunge's "3 × 8-12"
      // used to say nothing about which side, or both).
      const unilateral = display && isUnilateral(findAnimationId(name));
      return {
        name,
        display: unilateral ? `${display} each leg` : display,
        rest: readExerciseRest(e),
      };
    })
    .filter((e): e is ExerciseView => e !== null);
}

interface Ingredient {
  name: string;
  grams: number;
}

/** Same defensive narrowing for meal ingredients — grams is stored but was never shown. */
function getIngredients(details: Record<string, unknown>): Ingredient[] {
  const ingredients = details.ingredients;
  if (!Array.isArray(ingredients)) return [];

  return ingredients
    .map((i) => {
      if (!i || typeof i !== "object") return null;
      const { name, grams } = i as { name?: unknown; grams?: unknown };
      if (typeof name !== "string" || typeof grams !== "number") return null;
      return { name, grams };
    })
    .filter((i): i is Ingredient => i !== null);
}

interface DayCardProps {
  dayIndex: number;
  /** "Monday" — the headline. People navigate a plan by weekday, not by index. */
  weekday: string;
  /** "Aug 10" — the caption under it. */
  dateLabel: string;
  /** Highlights the card the user is actually on today. */
  isToday?: boolean;
  meals: PlanItemRow[];
  workouts: PlanItemRow[];
  kcalTarget: number | null;
  completedItemIds: Set<string>;
  pendingItemId: string | null;
  onToggleWorkout: (planItemId: string, done: boolean) => void;
  /** Today's card opens on load; the rest start collapsed. */
  defaultExpanded?: boolean;
}

export default function DayCard({
  dayIndex,
  weekday,
  dateLabel,
  isToday = false,
  meals,
  workouts,
  kcalTarget,
  completedItemIds,
  pendingItemId,
  onToggleWorkout,
  defaultExpanded = false,
}: DayCardProps) {
  const sortedMeals = [...meals].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  const sortedWorkouts = [...workouts].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  const dayKcal = meals.reduce((sum, m) => sum + (m.kcal ?? 0), 0);
  const [activeExercise, setActiveExercise] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Confirms the *action* of marking a workout done, not the `done` state
  // itself — keyed to the click, not the prop, so it never fires on initial
  // load for workouts that were already complete.
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const panelId = useId();

  const workoutsDone = sortedWorkouts.filter((w) => completedItemIds.has(w.id)).length;

  /**
   * Three states, not two. A rest day (meals, no workout) is a deliberate part
   * of the programme — the plan generator reserves them — but it used to render
   * with no label at all, which read as a missing workout rather than a
   * scheduled one. See the "rest-days-not-wasted" knowledge-base article.
   */
  const isEmpty = sortedMeals.length === 0 && sortedWorkouts.length === 0;
  const isRestDay = !isEmpty && sortedWorkouts.length === 0;
  const allDone = sortedWorkouts.length > 0 && workoutsDone === sortedWorkouts.length;

  // The spine is the card's whole identity now that the border and shadow are
  // gone — it has to carry "what kind of day is this, and did I do it".
  const spine = allDone
    ? "bg-emerald-500"
    : isRestDay
      ? "bg-foreground/15"
      : isEmpty
        ? "bg-foreground/8"
        : "bg-[var(--brand)]";

  return (
    <article
      className={`relative overflow-hidden rounded-xl bg-white dark:bg-[#1C1C1E] transition-shadow ${
        isToday ? "ring-1 ring-[var(--brand)]/30" : ""
      }`}
    >
      {/* Left spine replaces the generic border+shadow card outline. It encodes
          day state at a glance, which a uniform 1px grey border never did. */}
      <span aria-hidden="true" className={`absolute left-0 top-0 bottom-0 w-[3px] ${spine}`} />

      {/* A real button, not a click handler on a div: this has to be reachable
          by keyboard and announce its own expanded state. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full pl-6 pr-4 py-4 flex items-start justify-between gap-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="min-w-0">
          {/* Weekday leads. "Day 3" is an index into the plan; "Wednesday" is
              how someone actually finds the day they're standing in. */}
          <h3 className="text-base font-semibold text-foreground font-raleway truncate leading-tight">
            {weekday}
          </h3>
          <p className="text-[11px] text-foreground/40 font-merriweather-sans mt-0.5">
            {dateLabel} · Day {dayIndex + 1}
            {isToday && <span className="ml-1.5 font-semibold text-[var(--brand-hover)]">Today</span>}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
          {/* Workout completion as discrete pips — countable at a glance,
              unlike a "1/2 workouts" string you have to read. */}
          {sortedWorkouts.length > 0 && (
            <span
              className="flex items-center gap-1"
              role="img"
              aria-label={`${workoutsDone} of ${sortedWorkouts.length} workouts done`}
            >
              {sortedWorkouts.map((w) => (
                <span
                  key={w.id}
                  className={`w-1.5 h-1.5 rounded-full ${
                    completedItemIds.has(w.id) ? "bg-emerald-500" : "bg-[var(--brand)]/40"
                  }`}
                />
              ))}
            </span>
          )}
          {isRestDay && (
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground/45 font-merriweather-sans">
              <Moon className="w-3 h-3" />
              Rest
            </span>
          )}
          {isEmpty && (
            <span className="text-[11px] text-foreground/35 font-merriweather-sans">
              Empty
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-foreground/30 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Calories as a meter rather than a "1380 / 2560" string — the ratio is
          the point, and a bar reads it faster than arithmetic does. */}
      {kcalTarget !== null && !isEmpty && (
        <div className="pl-6 pr-4 pb-4 -mt-1">
          <MacroBar label="Calories" consumed={dayKcal} target={kcalTarget} unit="kcal" compact />
        </div>
      )}

      {expanded && (
        <div id={panelId} className="pl-6 pr-4 pb-5 pt-1 space-y-4 border-t border-black/5 dark:border-white/5">
          {/* Say why there's no workout, rather than leaving the user to guess
              whether the generator skipped a day. */}
          {isRestDay && (
            <div className="flex items-start gap-3 pt-4">
              <div className="w-7 h-7 rounded-lg bg-foreground/5 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <Moon className="w-3.5 h-3.5 text-foreground/50" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-raleway">
                  Recovery
                </p>
                <p className="text-sm text-foreground font-merriweather-sans">Rest day</p>
                <p className="mt-0.5 text-xs text-foreground/50 font-merriweather-sans">
                  No workout scheduled — this is when your body rebuilds. Keep eating to plan.
                </p>
              </div>
            </div>
          )}

          {sortedWorkouts.map((w) => {
            const done = completedItemIds.has(w.id);
            const pending = pendingItemId === w.id;
            const exercises = getExercises(w.details);

            return (
              <div key={w.id} className="flex items-start gap-3 pt-4">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    done ? "bg-[var(--brand)]" : "bg-[var(--brand)]/12"
                  } ${bouncingId === w.id ? "animate-bounce-confirm" : ""}`}
                >
                  {done ? (
                    <Check className="w-3.5 h-3.5 text-[var(--brand-ink)]" />
                  ) : (
                    <Dumbbell className="w-3.5 h-3.5 text-[var(--brand-hover)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-raleway">
                    {SLOT_LABELS[w.slot] ?? w.slot}
                  </p>
                  <p
                    className={`text-sm font-merriweather-sans ${
                      done ? "text-foreground/40 line-through" : "text-foreground"
                    }`}
                  >
                    {w.title}
                  </p>

                  {exercises.length > 0 && (
                    <>
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-foreground/35 uppercase tracking-wider font-raleway">
                        <span>Sets × reps</span>
                        <GlossaryHint term="sets" />
                        <GlossaryHint term="reps" />
                        <GlossaryHint term="rest" />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {exercises.map((ex, i) => (
                          // One button per exercise, with the numbers inside it
                          // rather than beside it — that grows the tap target
                          // instead of fragmenting it.
                          <button
                            key={i}
                            onClick={() => setActiveExercise(ex.name)}
                            className="px-2.5 py-1.5 rounded-lg text-left bg-[var(--surface-muted)] dark:bg-[#2A2A2E] hover:bg-[var(--brand)]/12 transition-colors cursor-pointer group"
                          >
                            <span className="block text-xs font-merriweather-sans text-foreground/80 group-hover:text-[var(--brand-hover)]">
                              {ex.name}
                            </span>
                            {ex.display && (
                              <span className="block text-[11px] font-semibold font-raleway text-foreground/50 tabular-nums">
                                {ex.display}
                                {ex.rest && (
                                  <span className="font-normal text-foreground/35"> · {ex.rest}</span>
                                )}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (!done) {
                        setBouncingId(w.id);
                        setTimeout(() => setBouncingId((v) => (v === w.id ? null : v)), 450);
                      }
                      onToggleWorkout(w.id, !done);
                    }}
                    disabled={pending}
                    className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-raleway transition-colors cursor-pointer disabled:opacity-50 ${
                      done
                        ? "bg-[var(--surface-muted)] dark:bg-[#2A2A2E] text-foreground/60"
                        : "bg-[var(--brand)]/12 text-[var(--brand-hover)] hover:bg-[var(--brand)]/20"
                    }`}
                  >
                    {pending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : done ? (
                      "Undo"
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        Mark done
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {sortedMeals.map((m) => {
            const ingredients = getIngredients(m.details);

            return (
              <div key={m.id} className="flex items-start gap-3 pt-4">
                <div className="w-7 h-7 rounded-lg bg-foreground/5 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Utensils className="w-3.5 h-3.5 text-foreground/50" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-raleway">
                      {SLOT_LABELS[m.slot] ?? m.slot}
                    </p>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-foreground/40 font-merriweather-sans tabular-nums">
                        {m.kcal} kcal
                      </span>
                      <GlossaryHint term="kcal" />
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-merriweather-sans">{m.title}</p>

                  {/* Ingredient grams have always been generated and stored —
                      this is the first place they're actually shown. */}
                  {ingredients.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {ingredients.map((ing, i) => (
                        <li
                          key={i}
                          className="flex items-baseline justify-between gap-3 text-xs font-merriweather-sans text-foreground/55"
                        >
                          <span className="min-w-0 truncate">{ing.name}</span>
                          <span className="shrink-0 tabular-nums">{ing.grams} g</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}

          {isEmpty && (
            <p className="pt-4 text-sm text-foreground/40 font-merriweather-sans">
              Nothing scheduled.
            </p>
          )}
        </div>
      )}

      <ExerciseDemoModal exerciseName={activeExercise} onClose={() => setActiveExercise(null)} />
    </article>
  );
}
