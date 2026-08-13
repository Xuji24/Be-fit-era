"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { findExercisePose, sampleFrame } from "@/lib/coach/exercise-poses";
import { addVec } from "@/lib/coach/rig-kinematics";
import {
  makeProjector,
  fitTransform,
  buildSegments,
  boxRect,
  floorY,
  VIEW_W,
  VIEW_H,
} from "@/lib/coach/rig-projection";

/**
 * One id per movement PATTERN, not per exercise name — a goblet squat and an
 * air squat read identically to someone trying to picture the movement, so
 * they share an animation. lib/coach/exercise-animations.ts owns the mapping
 * from the model's free-form exercise names onto these ids.
 *
 * Deliberately narrow and running-focused (knee/leg/calf/hamstring injury
 * prevention and strength work) rather than a generic gym set — see the
 * header comment in lib/coach/exercise-poses.ts for why.
 */
export type ExerciseAnimationId =
  | "squat"
  | "lunge"
  | "calf-raise"
  | "high-knees"
  | "glute-bridge"
  | "step-up"
  | "single-leg-rdl"
  | "lateral-band-walk"
  | "kettlebell-swing";

interface ExerciseRigProps {
  /** Omit to render the neutral standing figure — the last-resort placeholder
   *  when an exercise has neither an animation nor a reference photo. */
  animationId?: ExerciseAnimationId;
  className?: string;
}

/**
 * The 2D demonstration: the same figure and the same movement as the 3D view,
 * projected flat.
 *
 * It is DERIVED from the pose data now. Previously this was a hand-drawn SVG
 * animated by ~490 lines of CSS keyframes that restated the 3D joint angles by
 * hand — two copies of the same movement, which drifted apart and had to be
 * re-synced by eye whenever either changed. Both views now run through
 * lib/coach/rig-kinematics.ts, so that class of divergence is impossible and
 * the 2D fallback inherited every accuracy fix for free.
 */
export default function ExerciseRig({ animationId, className = "" }: ExerciseRigProps) {
  // The neutral placeholder is the squat's standing keyframe, so even the
  // "no animation" figure is a real, correctly-proportioned pose.
  const pose = findExercisePose(animationId ?? "squat")!;
  const animated = animationId !== undefined;

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const projector = useMemo(() => makeProjector(pose.camera.position), [pose]);
  const fit = useMemo(() => fitTransform(pose, projector), [pose, projector]);

  const [progress, setProgress] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!animated || reducedMotion) return;

    const start = performance.now();
    const tick = (now: number) => {
      setProgress((((now - start) / 1000) % pose.durationSec) / pose.durationSec);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    };
  }, [animated, reducedMotion, pose]);

  // A still should show the exercise's working end, not an arbitrary midpoint.
  const t = animated ? (reducedMotion ? pose.keyframes[1]?.t ?? 0.5 : progress) : 0;
  const frame = sampleFrame(pose, t);
  const segments = buildSegments(frame.skeleton, frame.root, projector, fit);

  const ground = floorY(fit);
  const box = animated && pose.prop?.kind === "box" ? boxRect(pose.prop, projector, fit) : null;

  const band =
    animated && pose.prop?.kind === "band"
      ? (["footL", "footR"] as const).map((b) => {
          const [x, y] = projector.project(addVec(frame.root, frame.skeleton[b].p));
          return [x * fit.scale + fit.offsetX, y * fit.scale + fit.offsetY] as const;
        })
      : null;

  // Held between both hands, so its position is the midpoint of the two
  // wrists (the forearm's TIP, not its joint) rather than a fixed prop —
  // same "derive, don't author" rule the root position follows.
  const kettlebell =
    animated && pose.prop?.kind === "kettlebell"
      ? (() => {
          const [lx, ly] = projector.project(addVec(frame.root, frame.skeleton.forearmL.tip));
          const [rx, ry] = projector.project(addVec(frame.root, frame.skeleton.forearmR.tip));
          return [
            ((lx + rx) / 2) * fit.scale + fit.offsetX,
            ((ly + ry) / 2) * fit.scale + fit.offsetY,
          ] as const;
        })()
      : null;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={className} fill="none">
      {/* Ground line — the reference that makes rising and sinking legible. */}
      <line
        x1={7} y1={ground} x2={VIEW_W - 7} y2={ground}
        stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" strokeLinecap="round"
      />

      {box && (
        <rect
          x={box.x} y={box.y} width={box.width} height={box.height}
          rx="3" fill="currentColor" fillOpacity="0.1"
          stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5"
        />
      )}

      {segments.map((s) =>
        s.kind === "head" ? (
          <circle key={s.key} cx={s.x1} cy={s.y1} r={s.radius} fill="currentColor" />
        ) : (
          <line
            key={s.key}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="currentColor" strokeWidth={s.width} strokeLinecap="round"
          />
        )
      )}

      {band && (
        <line
          x1={band[0][0]} y1={band[0][1]} x2={band[1][0]} y2={band[1][1]}
          stroke="currentColor" strokeOpacity="0.45" strokeWidth="4"
          strokeLinecap="round" strokeDasharray="6 4"
        />
      )}

      {kettlebell && (
        <circle cx={kettlebell[0]} cy={kettlebell[1]} r={fit.scale * 0.075} fill="currentColor" fillOpacity="0.55" />
      )}
    </svg>
  );
}
