/**
 * Sketch-style figure rig for exercise demonstrations, drawn with actual
 * body volume (rounded head, torso, capsule limbs) rather than bare
 * centerline strokes — closer to a rough figure-drawing sketch than a
 * stick figure. One SVG, drawn once, with each limb as an independently
 * transformable <g> group. Exercises animate by rotating/translating these
 * groups via CSS keyframes (see exercise-rig.module.css) — the rig itself
 * never changes, only which animationId class is applied to it.
 *
 * Joint pivot points (where a limb's <g transform-origin> sits) follow the
 * reference sketch: shoulder, elbow, hip, knee — so a rotation reads as a
 * bend at the right place instead of the whole limb swinging from its tip.
 * Group structure and pivot coordinates are unchanged from the stick-figure
 * version, so exercise-rig.module.css's keyframes apply as-is.
 */

import styles from "./exercise-rig.module.css";

export type ExerciseAnimationId = "squat" | "pushup" | "plank" | "lunge";

interface ExerciseRigProps {
  animationId: ExerciseAnimationId;
  className?: string;
}

export default function ExerciseRig({ animationId, className = "" }: ExerciseRigProps) {
  return (
    <svg
      viewBox="0 0 200 260"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className={`${styles["exercise-rig"]} ${styles[animationId]}`} fill="currentColor" fillOpacity="0.06">
        {/* Torso — wide rounded shape with a slight waist taper. The head is
            nested INSIDE this group (not a sibling) so a torso lean carries
            the head with it — an earlier pass left the head as a sibling,
            which detached it from the body during any torso rotation. */}
        <g className={styles["rig-torso"]} style={{ transformOrigin: "100px 90px" }}>
          <path d="M78 46 Q74 58 76 74 Q73 88 78 100 Q100 108 122 100 Q127 88 124 74 Q126 58 122 46 Q112 40 100 40 Q88 40 78 46 Z" />

          {/* Head — rounded, with a center-part hairline like the reference sketch */}
          <g className={styles["rig-head"]}>
            <ellipse cx="100" cy="26" rx="18" ry="20" />
            <path d="M100 8 L99 44" opacity="0.45" fill="none" />
            <path d="M84 22 Q100 18 116 22" opacity="0.45" fill="none" />
          </g>

          {/* Left arm: shoulder -> elbow, drawn as a tapered capsule */}
          <g className={styles["rig-arm-left"]} style={{ transformOrigin: "80px 52px" }}>
            <path d="M80 52 Q68 58 62 70 Q58 78 60 86 Q68 88 74 84 Q76 74 80 64 Q82 56 80 52 Z" />
            <g className={styles["rig-forearm-left"]} style={{ transformOrigin: "62px 80px" }}>
              <path d="M62 80 Q52 88 42 98 Q38 102 40 106 Q46 108 50 104 Q58 96 66 88 Q66 82 62 80 Z" />
              {/* fingers */}
              <path d="M40 105 L32 100 M38 108 L30 108 M39 111 L32 116" opacity="0.55" fill="none" />
            </g>
          </g>

          {/* Right arm: mirrored */}
          <g className={styles["rig-arm-right"]} style={{ transformOrigin: "120px 52px" }}>
            <path d="M120 52 Q132 58 138 70 Q142 78 140 86 Q132 88 126 84 Q124 74 120 64 Q118 56 120 52 Z" />
            <g className={styles["rig-forearm-right"]} style={{ transformOrigin: "138px 80px" }}>
              <path d="M138 80 Q148 88 158 98 Q162 102 160 106 Q154 108 150 104 Q142 96 134 88 Q134 82 138 80 Z" />
              <path d="M160 105 L168 100 M162 108 L170 108 M161 111 L168 116" opacity="0.55" fill="none" />
            </g>
          </g>
        </g>

        {/* Hips — rounded, where legs pivot; separate group so torso lean and
            hip hinge move independently */}
        <g className={styles["rig-hips"]} style={{ transformOrigin: "100px 102px" }}>
          <path d="M76 98 Q100 112 124 98 Q128 112 120 122 Q100 128 80 122 Q72 112 76 98 Z" />

          <g className={styles["rig-leg-left"]} style={{ transformOrigin: "88px 122px" }}>
            <path d="M88 122 Q78 132 76 150 Q74 164 78 176 Q86 178 92 174 Q92 158 90 142 Q92 130 88 122 Z" />
            <g className={styles["rig-shin-left"]} style={{ transformOrigin: "84px 174px" }}>
              <path d="M84 174 Q78 190 76 208 Q74 218 78 224 Q86 226 92 222 Q92 206 90 190 Q90 180 84 174 Z" />
              <path d="M76 223 Q64 226 60 232 L70 234 L84 232 L92 226 Q88 224 76 223 Z" opacity="0.7" />
            </g>
          </g>

          <g className={styles["rig-leg-right"]} style={{ transformOrigin: "112px 122px" }}>
            <path d="M112 122 Q122 132 124 150 Q126 164 122 176 Q114 178 108 174 Q108 158 110 142 Q108 130 112 122 Z" />
            <g className={styles["rig-shin-right"]} style={{ transformOrigin: "116px 174px" }}>
              <path d="M116 174 Q122 190 124 208 Q126 218 122 224 Q114 226 108 222 Q108 206 110 190 Q110 180 116 174 Z" />
              <path d="M124 223 Q136 226 140 232 L130 234 L116 232 L108 226 Q112 224 124 223 Z" opacity="0.7" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
