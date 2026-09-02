"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { X, Loader2, Rotate3d } from "lucide-react";
import { getExerciseDemo, type ExerciseDemo } from "@/app/actions/coach-exercise-actions";
import { findAnimationId } from "@/lib/coach/exercise-animations";
import { findExerciseGuide } from "@/lib/coach/exercise-guides";
import ExerciseRig from "./exercise-rig";

// three + @react-three/fiber (~200KB) must never reach a user who doesn't
// open a demo. ssr:false also matters on its own: WebGL has no server-side
// implementation, so a server-rendered attempt would just fail differently.
const ExerciseModel3D = dynamic(() => import("./exercise-model-3d"), {
  ssr: false,
  loading: () => (
    <div className="h-56 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-hover)]" />
    </div>
  ),
});

/**
 * Catches a WebGL context-creation failure inside the 3D canvas and renders
 * `fallback` (the 2D rig) instead of taking the whole modal down. The
 * upstream `hasWebGL()` check in the modal covers the common case (no WebGL
 * at all); this covers the rarer case where a context exists but rendering
 * still throws (driver quirks, exhausted contexts).
 *
 * Owns its failure state locally rather than lifting it into the modal: the
 * modal renders this with `key={exerciseName}`, so switching exercises
 * remounts the boundary and the failure clears on its own — no effect
 * needed to reset it, and a failure on one exercise never carries over to
 * the next.
 */
class Model3DBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

interface ExerciseDemoModalProps {
  exerciseName: string | null;
  onClose: () => void;
}

/**
 * Shows how to perform an exercise. Visual and text fall back independently,
 * so the modal is never empty and never silently textless.
 *
 * Visual — a four-tier fallback:
 *   1. An orbitable 3D mannequin (exercise-model-3d.tsx), when the browser
 *      has WebGL and the name maps to a movement we have pose data for. This
 *      exists because the 2D rig is a single fixed side view — it can't show
 *      which limb is in front or how a movement reads from another angle.
 *   2. The 2D hand-drawn animation (exercise-rig), when 3D isn't available
 *      but the name still maps to an animation. No network round trip either.
 *   3. A reference photo from wger.de, for names in the curated library.
 *   4. The neutral 2D figure as a placeholder.
 *
 * Text:
 *   1. Our own steps + form cues (lib/coach/exercise-guides.ts), which cover
 *      every exercise we can animate.
 *   2. wger's steps, for library exercises we have no guide for.
 *
 * The text fallback exists because wger covers only 9 exercises, so 8 of the
 * 12 animated movements used to open with a picture and no instructions.
 *
 * Every lookup table here is curated rather than fuzzy: showing a squat
 * animation for a deadlift would be worse than showing nothing.
 */
interface FetchState {
  /** Which exerciseName this result belongs to — lets "loading" be derived
      (result hasn't caught up to the current prop yet) instead of tracked
      as separate state set inside the effect. */
  forExercise: string;
  demo: ExerciseDemo | null;
}

export default function ExerciseDemoModal({ exerciseName, onClose }: ExerciseDemoModalProps) {
  const [result, setResult] = useState<FetchState | null>(null);
  // Checked once client-side after mount, not during SSR (no WebGL on the
  // server) and not eagerly on every render (creating a throwaway canvas per
  // render would be wasteful for a check whose answer never changes mid-session).
  const [webglAvailable, setWebglAvailable] = useState(false);

  useEffect(() => {
    // Intentional: WebGL support can only be checked client-side, so there is
    // no render-phase alternative to a one-time effect here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebglAvailable(hasWebGL());
  }, []);

  useEffect(() => {
    if (!exerciseName) return;

    let cancelled = false;
    getExerciseDemo(exerciseName).then((demo) => {
      if (!cancelled) setResult({ forExercise: exerciseName, demo });
    });

    return () => {
      cancelled = true;
    };
  }, [exerciseName]);

  const loading = exerciseName !== null && result?.forExercise !== exerciseName;
  const demo = result?.forExercise === exerciseName ? result.demo : null;
  const notFound = !loading && result?.forExercise === exerciseName && result.demo === null;

  // Resolved synchronously from a local table, so the animation is on screen
  // while the photo request is still in flight.
  const animationId = useMemo(
    () => (exerciseName ? findAnimationId(exerciseName) : null),
    [exerciseName]
  );

  // Our guides cover everything we animate; wger only fills the gap for
  // library exercises we have no guide for.
  const guide = useMemo(() => findExerciseGuide(animationId), [animationId]);
  const steps = guide?.steps ?? demo?.steps ?? [];

  const show3D = animationId !== null && webglAvailable;

  useEffect(() => {
    if (!exerciseName) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [exerciseName, onClose]);

  if (!exerciseName) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={exerciseName}
        className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 dark:border-white/5">
          <h2 className="text-sm font-semibold text-foreground font-raleway truncate">
            {demo?.name ?? exerciseName}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-foreground/40 hover:text-[var(--brand-hover)] hover:bg-[var(--brand)]/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Step 1 — orbitable 3D, when WebGL is available, with the 2D
              animation as its fallback (step 2) via `fallback`. Keying by
              exerciseName means switching exercises remounts the boundary,
              so a failure on one exercise never carries over to the next —
              see Model3DBoundary's comment. No await either way, so this
              fills the modal instead of a spinner while the photo loads. */}
          {animationId && (
            <Model3DBoundary
              key={exerciseName}
              fallback={
                <div className="flex items-center justify-center bg-[var(--surface-muted)] dark:bg-[#2A2A2E] py-4 text-[var(--brand-hover)]">
                  <ExerciseRig animationId={animationId} className="h-48 w-auto" />
                  <span className="sr-only">Animated demonstration of {exerciseName}</span>
                </div>
              }
            >
              {show3D ? (
                <div className="relative bg-[var(--surface-muted)] dark:bg-[#2A2A2E]">
                  <ExerciseModel3D animationId={animationId} className="h-56 w-full" />
                  <span className="pointer-events-none absolute bottom-2 right-2.5 inline-flex items-center gap-1 text-[10px] text-foreground/40 font-merriweather-sans">
                    <Rotate3d className="w-3 h-3" />
                    Drag to rotate
                  </span>
                  <span className="sr-only">Interactive 3D demonstration of {exerciseName}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center bg-[var(--surface-muted)] dark:bg-[#2A2A2E] py-4 text-[var(--brand-hover)]">
                  <ExerciseRig animationId={animationId} className="h-48 w-auto" />
                  <span className="sr-only">Animated demonstration of {exerciseName}</span>
                </div>
              )}
            </Model3DBoundary>
          )}

          {loading && !animationId && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-hover)]" />
            </div>
          )}

          {/* Step 3 — neither an animation nor a photo. The neutral figure
              beats an empty panel, and the copy says plainly why. */}
          {notFound && !animationId && (
            <div className="px-5 py-8 flex flex-col items-center gap-3">
              <ExerciseRig className="h-32 w-auto text-foreground/15" />
              <p className="text-center text-sm text-foreground/50 font-merriweather-sans">
                No demonstration for this one yet — check your plan&apos;s notes, or ask the coach how to do it.
              </p>
            </div>
          )}

          {/* Step 2 — the photo, but only when no animation is already showing
              the movement. Two visuals of the same exercise stacked reads as a
              mistake. */}
          {demo?.imageUrl && !animationId && (
            // wger-hosted images are external and user-agnostic reference
            // photos, not something worth Next/Image optimizing for.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={demo.imageUrl} alt={demo.name} className="w-full bg-[var(--surface-muted)] dark:bg-[#2A2A2E]" />
          )}

          {/* Our own steps win over wger's: they cover every exercise we can
              animate, and they're written in the coach's plain-language voice.
              wger fills in for library exercises we have no guide for. */}
          {steps.length > 0 && (
            <ol className="px-5 pt-4 space-y-2.5 list-decimal list-inside">
              {steps.map((step, i) => (
                <li key={i} className="text-sm text-foreground font-merriweather-sans">
                  {step}
                </li>
              ))}
            </ol>
          )}

          {guide && guide.cues.length > 0 && (
            <div className="px-5 pt-4 pb-4">
              <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider font-raleway mb-1.5">
                Watch out for
              </p>
              <ul className="space-y-1.5">
                {guide.cues.map((cue, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-xs text-foreground/60 font-merriweather-sans"
                  >
                    <span className="text-[var(--brand-hover)] shrink-0">·</span>
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Only reachable for an exercise in neither table. */}
          {steps.length === 0 && !loading && animationId && (
            <p className="px-5 py-4 text-center text-xs text-foreground/40 font-merriweather-sans">
              Written steps aren&apos;t available for this exercise yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
