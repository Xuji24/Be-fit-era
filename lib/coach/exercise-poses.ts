/**
 * Joint keyframes driving both demonstration views — the 3D mannequin
 * (exercise-model-3d.tsx) and the 2D rig (exercise-rig.tsx). Both now render
 * from this data through the same solver, so they cannot disagree; the
 * previous pass hand-duplicated these angles as CSS keyframes and the two
 * views drifted apart.
 *
 * The exercise set is deliberately narrow and running-focused — knee/leg/calf/
 * hamstring injury-prevention and strength work, not a generic gym split.
 * Fitra's core product is running races.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW A POSE IS BUILT (read this before adding an exercise)
 *
 * Every exercise here is anchored by something touching the ground. That
 * contact — not the hips — is what stays still while the body moves around
 * it. So a keyframe declares TWO things:
 *
 *   joints   the angles, as before
 *   contact  which point of the body is planted, and where it is in the world
 *
 * The figure's root position is then DERIVED from the contact by
 * rig-kinematics.ts. You never author a height. This replaces the old
 * `liftY` field, which could not work: foot height is a trigonometric
 * function of the joint angles, so a per-keyframe constant can be tuned to
 * land correctly AT the keyframes and is necessarily wrong between them.
 * Measured on the old data, squat's feet sank 78 mm through the floor
 * mid-descent, the lunge happened 12 cm in the air, and the glute bridge
 * floated a full metre off the ground.
 *
 * Pick the anchor from the exercise's own mechanics:
 *   squat / RDL / band walk   a heel (foot stays flat)
 *   calf raise / high knees   a ball (heel lifts off it — that IS the movement)
 *   lunge                     the REAR ball, which never moves for the whole rep
 *   step-up                   switches floor -> box top as weight transfers
 *   glute bridge              the upper back, the one part that truly never moves
 *
 * When consecutive keyframes name different contacts, the solver cross-fades
 * between the two implied root positions across that segment. That is a
 * weight transfer, and it is why the alternating exercises don't skate.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ANGLES (degrees; see rig-skeleton.ts for the frame convention)
 *   Negative x swings a downward-hanging limb forward, so hip and shoulder
 *   flexion are negative and knee flexion is positive.
 *   Positive spine.x leans the torso forward.
 *   The foot extends along +Z rather than -Y, so its sign reads the other
 *   way round: POSITIVE foot.x is plantarflexion (heel up, the calf-raise
 *   movement), negative is dorsiflexion. A flat foot is foot.x = -(the
 *   shin's world pitch); most of the flat-foot values below were derived
 *   that way rather than guessed.
 *
 * Ranges of motion are taken from the movement each exercise's written guide
 * describes (lib/coach/exercise-guides.ts) and solved with 2-link IK from the
 * foot position, not eyeballed.
 *
 * `base` is the explicit rest pose. Every keyframe is `base` overlaid with
 * its own `joints`, and the sampler returns a value for EVERY joint on every
 * frame. The old implicit "no entry means 0" rule is gone: 0 only means
 * "hanging parallel to the spine", which is a correct default for a standing
 * body and silently wrong for a lying one — that is what made an earlier
 * pass render a floor exercise as a falling superman pose.
 *
 * All motion loops, so every sequence's last keyframe matches its first.
 */

import type { ContactPointName, JointName, JointRotation, Vec3 } from "./rig-skeleton";
import { solveSkeleton, rootForContact, lerpVec, type Skeleton } from "./rig-kinematics";
import type { ExerciseAnimationId } from "@/components/pages/main/coach/component/exercise-rig";

export type { JointName, JointRotation, Vec3 } from "./rig-skeleton";
export { JOINT_NAMES } from "./rig-skeleton";

/**
 * How the segment STARTING at a keyframe is timed.
 * `inOut` is the default because a strength rep starts and ends at rest;
 * `linear` exists for genuinely cyclic movement (running cadence), where
 * easing into every keyframe would read as a stutter rather than control.
 */
export type EaseName = "inOut" | "linear" | "in" | "out";

export interface Contact {
  point: ContactPointName;
  /** Where that point sits in the world. y = 0 is the floor. */
  at: Vec3;
}

export interface PoseKeyframe {
  /** Normalized time in the loop, 0 to 1 inclusive. */
  t: number;
  joints: Partial<Record<JointName, JointRotation>>;
  contact: Contact;
  ease?: EaseName;
}

/** Scene furniture the movement is performed on or with. */
export type ExerciseProp =
  | { kind: "box"; width: number; height: number; depth: number; center: Vec3 }
  | { kind: "band"; around: "ankles" }
  | { kind: "kettlebell" };

export interface ExercisePose {
  /** Root pitch applied before joint rotations — lies the figure down for floor work. */
  bodyPitch: number;
  durationSec: number;
  base: Partial<Record<JointName, JointRotation>>;
  keyframes: PoseKeyframe[];
  /** Framed on the plane the movement actually happens in. */
  camera: { position: Vec3; target: Vec3 };
  prop?: ExerciseProp;
}

const STANDING = 0;
/** Face-up. Unlike the previous pass, lying down no longer means floating. */
const SUPINE = -90;

// Standing contact positions: hips are HIP_HALF_WIDTH either side of centre,
// the heel sits just behind the ankle and the ball well in front of it.
const HEEL_L: Vec3 = [-0.09, 0, -0.05];
const HEEL_R: Vec3 = [0.09, 0, -0.05];
const BALL_L: Vec3 = [-0.09, 0, 0.11];
const BALL_R: Vec3 = [0.09, 0, 0.11];

/** Step-up box top, and where the lead heel lands on it. */
const BOX_TOP = 0.36;
const BOX_HEEL: Vec3 = [-0.09, BOX_TOP, 0.35];

/**
 * Lateral band walk stance widths, solved rather than chosen: with the hips
 * abducting SYMMETRICALLY both feet stay level, so either heel can anchor and
 * the other still lands exactly on the floor. Abducting only the stepping leg
 * lifts that foot ~20 mm and no knee angle compensates for it.
 */
const WALK_HEEL_WIDE: Vec3 = [-0.3743, 0, -0.05];

export const EXERCISE_POSES: Record<ExerciseAnimationId, ExercisePose> = {
  /**
   * Parallel squat. Both feet stay flat, so the left heel anchors the whole
   * rep and the right leg mirrors it exactly.
   *
   * The hips travelling BACKWARD is the part the old version could not show:
   * with a planted foot and the knee tracking over the toe, hip travel is
   * forced by the geometry rather than animated separately, which is what
   * "push your hips back as if sitting into a chair" actually looks like.
   * Derived for a 0.43 m hip drop with the ankle 0.24 m behind the hip:
   * 103 degrees of knee flexion and 25 degrees of ankle dorsiflexion, both
   * comfortably inside a bodyweight squat's range.
   */
  squat: {
    bodyPitch: STANDING,
    durationSec: 3.0,
    base: {},
    camera: { position: [2.0, 1.05, 1.35], target: [0, 0.62, 0.12] },
    keyframes: [
      { t: 0, joints: {}, contact: { point: "heelL", at: HEEL_L }, ease: "inOut" },
      {
        t: 0.55,
        joints: {
          spine: { x: 38 },
          head: { x: -26 },
          thighL: { x: -78 }, shinL: { x: 103 }, footL: { x: -25 },
          thighR: { x: -78 }, shinR: { x: 103 }, footR: { x: -25 },
          // Reaching forward for balance, which the guide calls out. The arms
          // hang off the leaned torso, so the shoulder angle has to undo the
          // 38 degrees of lean to end up horizontal in the world.
          upperArmL: { x: -113 }, forearmL: { x: -8 },
          upperArmR: { x: -113 }, forearmR: { x: -8 },
        },
        contact: { point: "heelL", at: HEEL_L },
        ease: "inOut",
      },
      { t: 1, joints: {}, contact: { point: "heelL", at: HEEL_L } },
    ],
  },

  /**
   * Forward lunge on the left leg and back to standing.
   *
   * Anchored on the REAR ball for the entire rep — in a lunge the rear foot
   * never goes anywhere, only its heel lifts off, so there is no contact
   * switch and no opportunity to skate. The rear heel rising to ~11 cm is
   * derived from the leg angles, not animated.
   *
   * At the bottom: front knee 82 degrees with the knee stacked at the toe
   * rather than past it, rear knee 86 degrees and 20 cm off the floor.
   */
  lunge: {
    bodyPitch: STANDING,
    durationSec: 3.2,
    base: {},
    camera: { position: [2.5, 0.95, 0.7], target: [0, 0.62, 0.05] },
    keyframes: [
      { t: 0, joints: {}, contact: { point: "ballR", at: BALL_R }, ease: "inOut" },
      {
        // Mid-step: the left leg is in the air on its way forward.
        t: 0.2,
        joints: {
          thighL: { x: -42 }, shinL: { x: 58 }, footL: { x: -14 },
          spine: { x: 4 },
          upperArmR: { x: -16 }, upperArmL: { x: 10 },
        },
        contact: { point: "ballR", at: BALL_R },
        ease: "inOut",
      },
      {
        t: 0.5,
        joints: {
          spine: { x: 8 },
          thighL: { x: -67 }, shinL: { x: 82 }, footL: { x: -15 },
          thighR: { x: -7 }, shinR: { x: 86 }, footR: { x: -34 },
          upperArmR: { x: -26 }, forearmR: { x: -20 },
          upperArmL: { x: 16 },
        },
        contact: { point: "ballR", at: BALL_R },
        ease: "inOut",
      },
      {
        t: 0.8,
        joints: {
          thighL: { x: -42 }, shinL: { x: 58 }, footL: { x: -14 },
          spine: { x: 4 },
          upperArmR: { x: -16 }, upperArmL: { x: 10 },
        },
        contact: { point: "ballR", at: BALL_R },
        ease: "inOut",
      },
      { t: 1, joints: {}, contact: { point: "ballR", at: BALL_R } },
    ],
  },

  /**
   * Standing calf raise — now an actual ankle movement.
   *
   * The old version had no foot segment at all and faked the raise by
   * translating the whole figure upward, which reads as levitation. With a
   * real foot, the BALL is the anchor and 48 degrees of plantarflexion lifts
   * the heel to ~12 cm while the ball stays welded to the floor. The body
   * rising ~6 cm is a consequence of that rotation, not a separate animation.
   *
   * Slow, and slower on the way down: the guide's first cue is that the
   * lowering half is where the work happens.
   */
  "calf-raise": {
    bodyPitch: STANDING,
    durationSec: 3.0,
    base: { upperArmL: { x: -12 }, upperArmR: { x: -12 }, forearmL: { x: -22 }, forearmR: { x: -22 } },
    camera: { position: [1.55, 0.72, 1.05], target: [0, 0.5, 0.04] },
    keyframes: [
      // Heels down and flat at the bottom. They cannot go BELOW flat: with
      // the ball anchored, any dorsiflexion here drives the heel through the
      // floor rather than stretching the calf.
      { t: 0, joints: { footL: { x: 0 }, footR: { x: 0 } }, contact: { point: "ballL", at: BALL_L }, ease: "inOut" },
      {
        t: 0.4,
        joints: { footL: { x: 48 }, footR: { x: 48 } },
        contact: { point: "ballL", at: BALL_L },
        ease: "inOut",
      },
      {
        // Brief hold at the top before the slow lowering.
        t: 0.52,
        joints: { footL: { x: 48 }, footR: { x: 48 } },
        contact: { point: "ballL", at: BALL_L },
        ease: "inOut",
      },
      { t: 1, joints: { footL: { x: 0 }, footR: { x: 0 } }, contact: { point: "ballL", at: BALL_L } },
    ],
  },

  /**
   * High knees. Cyclic, so the segments are linear rather than eased —
   * easing into every keyframe would read as four separate poses instead of
   * a running cadence.
   *
   * Anchored on the ball of whichever foot is down. The stance leg is close
   * to straight and up on the ball, which is the "stay on the balls of your
   * feet" cue; the drive knee reaches hip height (thigh horizontal).
   *
   * The weight transfer gets its own short window (0.20-0.26 and 0.70-0.76)
   * holding a SYMMETRIC passing pose. That matters: with identical joints
   * either side of a contact change, the two anchors imply the same root, so
   * the handover is exact. Spreading the transfer across a whole quarter of
   * the loop instead — as the first attempt did — left the solver blending
   * between two disagreeing roots and drove the incoming foot 87 mm through
   * the floor.
   */
  "high-knees": {
    bodyPitch: STANDING,
    durationSec: 1.1,
    base: { forearmL: { x: -72 }, forearmR: { x: -72 } },
    camera: { position: [2.15, 1.05, 1.2], target: [0, 0.78, 0.05] },
    keyframes: [
      {
        // Left knee at hip height, right foot on the ball.
        t: 0,
        joints: {
          thighL: { x: -85 }, shinL: { x: 85 }, footL: { x: -12 },
          thighR: { x: -10 }, shinR: { x: 18 }, footR: { x: 17 },
          upperArmR: { x: -48 }, upperArmL: { x: 26 },
        },
        contact: { point: "ballR", at: BALL_R },
        ease: "inOut",
      },
      {
        // Passing: both balls on the floor, weight about to transfer.
        t: 0.2,
        joints: {
          thighL: { x: -22 }, shinL: { x: 28 }, footL: { x: 14 },
          thighR: { x: -22 }, shinR: { x: 28 }, footR: { x: 14 },
          upperArmR: { x: -18 }, upperArmL: { x: 14 },
        },
        contact: { point: "ballR", at: BALL_R },
        ease: "inOut",
      },
      {
        // Same pose, weight now on the left — an exact handover.
        t: 0.26,
        joints: {
          thighL: { x: -22 }, shinL: { x: 28 }, footL: { x: 14 },
          thighR: { x: -22 }, shinR: { x: 28 }, footR: { x: 14 },
          upperArmR: { x: -18 }, upperArmL: { x: 14 },
        },
        contact: { point: "ballL", at: BALL_L },
        ease: "inOut",
      },
      {
        // Mirror: right knee up, left foot on the ball.
        t: 0.5,
        joints: {
          thighR: { x: -85 }, shinR: { x: 85 }, footR: { x: -12 },
          thighL: { x: -10 }, shinL: { x: 18 }, footL: { x: 17 },
          upperArmL: { x: -48 }, upperArmR: { x: 26 },
        },
        contact: { point: "ballL", at: BALL_L },
        ease: "inOut",
      },
      {
        t: 0.7,
        joints: {
          thighL: { x: -22 }, shinL: { x: 28 }, footL: { x: 14 },
          thighR: { x: -22 }, shinR: { x: 28 }, footR: { x: 14 },
          upperArmL: { x: -18 }, upperArmR: { x: 14 },
        },
        contact: { point: "ballL", at: BALL_L },
        ease: "inOut",
      },
      {
        t: 0.76,
        joints: {
          thighL: { x: -22 }, shinL: { x: 28 }, footL: { x: 14 },
          thighR: { x: -22 }, shinR: { x: 28 }, footR: { x: 14 },
          upperArmL: { x: -18 }, upperArmR: { x: 14 },
        },
        contact: { point: "ballR", at: BALL_R },
        ease: "inOut",
      },
      {
        t: 1,
        joints: {
          thighL: { x: -85 }, shinL: { x: 85 }, footL: { x: -12 },
          thighR: { x: -10 }, shinR: { x: 18 }, footR: { x: 17 },
          upperArmR: { x: -48 }, upperArmL: { x: 26 },
        },
        contact: { point: "ballR", at: BALL_R },
      },
    ],
  },

  /**
   * Glute bridge.
   *
   * Anchored on the UPPER BACK, which is the only part of the body that
   * genuinely never moves during the rep — the shoulders stay pinned and the
   * hips swing up around them. The old version rotated the whole figure about
   * a root held at standing hip height, which is why it performed the
   * exercise a metre in the air with its "planted" feet travelling half a
   * metre.
   *
   * The hips rising comes from the spine angle (torso ramping up from the
   * pinned shoulders), and the leg angles open just enough to keep the feet
   * flat on the floor underneath.
   */
  "glute-bridge": {
    bodyPitch: SUPINE,
    durationSec: 3.0,
    // Arms flat on the floor beside the hips. With the body lying down these
    // must be explicit at rest — see the note on `base` in the header.
    base: { upperArmL: { x: 4 }, upperArmR: { x: 4 }, forearmL: { x: 4 }, forearmR: { x: 4 } },
    camera: { position: [2.05, 0.78, 1.15], target: [0, 0.24, -0.05] },
    keyframes: [
      {
        // Hips down. Leg angles solved so the soles sit flat on the floor at
        // a fixed spot, with the knee ~114 degrees — feet close to the hips,
        // which is the guide's fix for heels lifting.
        t: 0,
        joints: {
          spine: { x: 0 }, head: { x: -6 },
          thighL: { x: -45.2 }, shinL: { x: 114.1 }, footL: { x: 21.1 },
          thighR: { x: -45.2 }, shinR: { x: 114.1 }, footR: { x: 21.1 },
        },
        contact: { point: "upperBack", at: [0, 0, -0.1] },
        ease: "in",
      },
      {
        // Mid-rep, solved for the SAME ankle spot rather than left to
        // interpolation. Interpolating angles does not interpolate foot
        // position, so two solved poses alone let the planted heel wander
        // ~20 mm through the middle of the rep; a solved midpoint cuts that
        // to a couple of millimetres.
        t: 0.22,
        joints: {
          spine: { x: -13 }, head: { x: 16 },
          thighL: { x: -31.4 }, shinL: { x: 103.3 }, footL: { x: 18.1 },
          thighR: { x: -31.4 }, shinR: { x: 103.3 }, footR: { x: 18.1 },
        },
        contact: { point: "upperBack", at: [0, 0, -0.1] },
        ease: "linear",
      },
      {
        // Top. The spine angle swings the hips up around the pinned
        // shoulders; the leg angles are re-solved for the SAME ankle spot, so
        // the feet stay planted and the knees stay put while the hips rise
        // 16 cm into a knees-hips-shoulders ramp.
        t: 0.45,
        joints: {
          // The chin tucks as the hips rise — without it the tilting torso
          // would carry the skull straight through the floor.
          spine: { x: -26 }, head: { x: 32 },
          thighL: { x: -19 }, shinL: { x: 87.4 }, footL: { x: 21.5 },
          thighR: { x: -19 }, shinR: { x: 87.4 }, footR: { x: 21.5 },
        },
        contact: { point: "upperBack", at: [0, 0, -0.1] },
        ease: "inOut",
      },
      {
        // Squeeze and hold at the top.
        t: 0.6,
        joints: {
          // The chin tucks as the hips rise — without it the tilting torso
          // would carry the skull straight through the floor.
          spine: { x: -26 }, head: { x: 32 },
          thighL: { x: -19 }, shinL: { x: 87.4 }, footL: { x: 21.5 },
          thighR: { x: -19 }, shinR: { x: 87.4 }, footR: { x: 21.5 },
        },
        contact: { point: "upperBack", at: [0, 0, -0.1] },
        ease: "out",
      },
      {
        t: 0.82,
        joints: {
          spine: { x: -13 }, head: { x: 16 },
          thighL: { x: -31.4 }, shinL: { x: 103.3 }, footL: { x: 18.1 },
          thighR: { x: -31.4 }, shinR: { x: 103.3 }, footR: { x: 18.1 },
        },
        contact: { point: "upperBack", at: [0, 0, -0.1] },
        ease: "linear",
      },
      {
        t: 1,
        joints: {
          spine: { x: 0 }, head: { x: -6 },
          thighL: { x: -45.2 }, shinL: { x: 114.1 }, footL: { x: 21.1 },
          thighR: { x: -45.2 }, shinR: { x: 114.1 }, footR: { x: 21.1 },
        },
        contact: { point: "upperBack", at: [0, 0, -0.1] },
      },
    ],
  },

  /**
   * Step-up onto a knee-height box, leading with the left leg.
   *
   * The contact moves from the floor to the box top as the weight transfers,
   * which is what makes the body rise: the height comes from standing up on
   * a real surface rather than from a translation. There is a box in the
   * scene for the same reason — a step-up rising onto nothing cannot read as
   * a step-up however good the angles are.
   */
  "step-up": {
    bodyPitch: STANDING,
    durationSec: 2.8,
    base: {},
    camera: { position: [2.5, 1.25, 1.55], target: [0, 0.82, 0.18] },
    // Knee height for this 1.72 m figure. The box sits far enough forward
    // that the standing figure's toes clear its front face.
    prop: { kind: "box", width: 0.62, height: BOX_TOP, depth: 0.42, center: [0, BOX_TOP / 2, 0.52] },
    keyframes: [
      { t: 0, joints: {}, contact: { point: "heelR", at: HEEL_R }, ease: "inOut" },
      {
        // Knee lifted so the foot clears the box's front face before it
        // travels forward. Without this the lead foot slid horizontally
        // straight THROUGH the front of the box on its way to the top.
        t: 0.15,
        joints: {
          thighL: { x: -76 }, shinL: { x: 118 }, footL: { x: -38 },
          spine: { x: 10 },
          upperArmR: { x: -18 }, upperArmL: { x: 12 },
        },
        contact: { point: "heelR", at: HEEL_R },
        ease: "inOut",
      },
      {
        // Lead foot placed FLAT ON THE BOX TOP — angles solved for that, not
        // for a height that happened to look close. The first pass put the
        // heel at 0.34 with a 0.40 box, sinking the foot into the prop.
        t: 0.32,
        joints: {
          thighL: { x: -81.7 }, shinL: { x: 84 }, footL: { x: -2.3 },
          spine: { x: 14 },
          upperArmR: { x: -22 }, upperArmL: { x: 14 },
        },
        contact: { point: "heelR", at: HEEL_R },
        ease: "inOut",
      },
      {
        // Same stance, weight handed to the box leg. Both anchors describe
        // this one pose, so the handover is exact — blending the transfer
        // across the whole rise instead dragged the planted foot 172 mm down
        // into the box.
        t: 0.36,
        joints: {
          thighL: { x: -81.7 }, shinL: { x: 84 }, footL: { x: -2.3 },
          spine: { x: 14 },
          upperArmR: { x: -22 }, upperArmL: { x: 14 },
        },
        contact: { point: "heelL", at: BOX_HEEL },
        ease: "inOut",
      },
      {
        // Standing tall on the box, trailing leg following naturally.
        t: 0.55,
        joints: {
          thighL: { x: -6 }, shinL: { x: 13 }, footL: { x: -7 },
          // The trailing leg TRAILS — kept behind the box rather than swung
          // forward over it, which would sweep the foot through the prop.
          thighR: { x: 20 }, shinR: { x: 40 }, footR: { x: 12 },
          spine: { x: 2 },
          upperArmR: { x: 10 }, upperArmL: { x: -8 },
        },
        contact: { point: "heelL", at: BOX_HEEL },
        ease: "inOut",
      },
      {
        // Lowering under control, trailing leg reaching back for the floor.
        t: 0.8,
        joints: {
          // Lead foot stays FLAT on the box (foot.x = -(thigh+knee)); the
          // trailing toes stay up so the heel lands first on the way down.
          thighL: { x: -78 }, shinL: { x: 88 }, footL: { x: -10 },
          thighR: { x: 8 }, shinR: { x: 26 }, footR: { x: -8 },
          spine: { x: 14 },
          upperArmR: { x: -20 }, upperArmL: { x: 12 },
        },
        contact: { point: "heelL", at: BOX_HEEL },
        ease: "inOut",
      },
      {
        // Trailing foot has landed: both feet down, one on the floor and one
        // on the box. This exact stance satisfies BOTH anchors at once, which
        // is what makes the handover back to the floor leg lossless.
        t: 0.86,
        joints: {
          thighL: { x: -81.7 }, shinL: { x: 84 }, footL: { x: -2.3 },
          spine: { x: 14 },
          upperArmR: { x: -22 }, upperArmL: { x: 14 },
        },
        contact: { point: "heelL", at: BOX_HEEL },
        ease: "inOut",
      },
      {
        t: 0.9,
        joints: {
          thighL: { x: -81.7 }, shinL: { x: 84 }, footL: { x: -2.3 },
          spine: { x: 14 },
          upperArmR: { x: -22 }, upperArmL: { x: 14 },
        },
        contact: { point: "heelR", at: HEEL_R },
        ease: "inOut",
      },
      {
        // Lead foot lifts off the box and clears its front face on the way
        // back, the same reason the ascent needs a lift keyframe.
        t: 0.96,
        joints: {
          thighL: { x: -76 }, shinL: { x: 118 }, footL: { x: -38 },
          spine: { x: 10 },
          upperArmR: { x: -18 }, upperArmL: { x: 12 },
        },
        contact: { point: "heelR", at: HEEL_R },
        ease: "inOut",
      },
      { t: 1, joints: {}, contact: { point: "heelR", at: HEEL_R } },
    ],
  },

  /**
   * Single-leg Romanian deadlift on the left leg.
   *
   * Stance heel anchored, so the hips travelling backward as the torso comes
   * down is forced by the geometry rather than animated — with a planted foot
   * and a near-vertical shin, hinging forward has nowhere else to put the
   * hips. That counterbalance is the whole skill of the movement.
   *
   * Derived for a 0.85 m hip height with the hips 0.18 m behind the ankle:
   * 25 degrees of knee flexion (the "soft bend", not locked, not a squat) and
   * a vertical shin. The free leg continues the torso's line into one
   * straight tripod from head to raised heel, and the arms hang vertically —
   * which, with the torso near horizontal, means undoing the whole lean.
   */
  "single-leg-rdl": {
    bodyPitch: STANDING,
    durationSec: 3.4,
    base: {},
    camera: { position: [2.45, 0.95, 1.0], target: [0, 0.68, -0.05] },
    keyframes: [
      {
        t: 0,
        joints: {
          thighR: { x: 12 }, shinR: { x: 16 }, footR: { x: 10 },
          thighL: { x: -2 }, shinL: { x: 6 }, footL: { x: -6 },
        },
        contact: { point: "heelL", at: HEEL_L },
        ease: "inOut",
      },
      {
        t: 0.5,
        joints: {
          spine: { x: 78 },
          head: { x: -32 },
          thighL: { x: -25 }, shinL: { x: 25 }, footL: { x: 0 },
          thighR: { x: 105 }, shinR: { x: 5 }, footR: { x: 25 },
          upperArmL: { x: -72 }, upperArmR: { x: -72 },
          forearmL: { x: -6 }, forearmR: { x: -6 },
        },
        contact: { point: "heelL", at: HEEL_L },
        ease: "inOut",
      },
      {
        t: 1,
        joints: {
          thighR: { x: 12 }, shinR: { x: 16 }, footR: { x: 10 },
          thighL: { x: -2 }, shinL: { x: 6 }, footL: { x: -6 },
        },
        contact: { point: "heelL", at: HEEL_L },
      },
    ],
  },

  /**
   * Lateral band walk — a sustained quarter-squat with the knees pushing out
   * against a band, stepping out and dragging in.
   *
   * Travels out to one side and back over the loop rather than in one
   * direction, so it both matches the guide ("the same number of steps in
   * each direction") and returns exactly to its start — a one-way walk would
   * either march off camera or need a reset, and a reset is a teleport.
   *
   * The knee bend is held at every keyframe rather than returning to
   * standing: standing up between reps is the single most common way to make
   * this exercise do nothing, and the guide's second cue says so.
   */
  "lateral-band-walk": {
    bodyPitch: STANDING,
    durationSec: 2.6,
    base: {
      spine: { x: 10 },
      thighL: { x: -20 }, shinL: { x: 29 }, footL: { x: -9 },
      thighR: { x: -20 }, shinR: { x: 29 }, footR: { x: -9 },
      upperArmL: { x: -28 }, upperArmR: { x: -28 },
      forearmL: { x: -62 }, forearmR: { x: -62 },
    },
    camera: { position: [0.42, 1.0, 2.45], target: [-0.14, 0.58, 0] },
    prop: { kind: "band", around: "ankles" },
    keyframes: [
      {
        // Narrow, weight on the right foot.
        t: 0,
        joints: { thighL: { x: -20, z: -3 }, thighR: { x: -20, z: 3 } },
        contact: { point: "heelR", at: HEEL_R },
        ease: "inOut",
      },
      {
        // Wide: the right heel is pinned, so widening steps the LEFT foot out.
        t: 0.22,
        joints: { thighL: { x: -20, z: -10 }, thighR: { x: -20, z: 10 } },
        contact: { point: "heelR", at: HEEL_R },
        ease: "inOut",
      },
      {
        // Same pose, weight handed to the left foot.
        t: 0.28,
        joints: { thighL: { x: -20, z: -10 }, thighR: { x: -20, z: 10 } },
        contact: { point: "heelL", at: WALK_HEEL_WIDE },
        ease: "inOut",
      },
      {
        // Narrowing with the left pinned drags the RIGHT foot in — one full
        // step to the left completed, body carried with it.
        t: 0.5,
        joints: { thighL: { x: -20, z: -3 }, thighR: { x: -20, z: 3 } },
        contact: { point: "heelL", at: WALK_HEEL_WIDE },
        ease: "inOut",
      },
      {
        // Back the other way: widening on the left pin steps the right out.
        t: 0.72,
        joints: { thighL: { x: -20, z: -10 }, thighR: { x: -20, z: 10 } },
        contact: { point: "heelL", at: WALK_HEEL_WIDE },
        ease: "inOut",
      },
      {
        t: 0.78,
        joints: { thighL: { x: -20, z: -10 }, thighR: { x: -20, z: 10 } },
        contact: { point: "heelR", at: HEEL_R },
        ease: "inOut",
      },
      {
        t: 1,
        joints: { thighL: { x: -20, z: -3 }, thighR: { x: -20, z: 3 } },
        contact: { point: "heelR", at: HEEL_R },
      },
    ],
  },

  /**
   * Two-hand kettlebell swing. Bilateral and symmetric throughout — unlike
   * step-up/high-knees/band-walk there is no weight transfer, so this is
   * architecturally the same shape as squat: anchor the left heel and let
   * symmetric joint angles put the right heel in the same place for free.
   *
   * A hip hinge, not a squat: moderate knee flexion (42 degrees at the
   * bottom) against the RDL's soft ~10-degree bend and the squat's 103 —
   * the power comes from the hips snapping open, not the knees extending.
   * Flat-foot values are solved the same way as elsewhere: foot.x =
   * -(thigh.x + shin.x), the shin's world pitch. Source: standard
   * hardstyle/Russian swing coaching cues (hip hinge to ~45-55 degrees of
   * torso lean, arms passively along for the ride) — see
   * docs/EXERCISE_CATALOG_RESEARCH.md for the injury-prevention/running-
   * economy evidence this was prioritized on.
   *
   * The kettlebell itself is never authored a position — like the root, it
   * is derived each frame as the midpoint of both wrists (rig-projection.ts
   * / exercise-model-3d.tsx), so it can never drift from the hands holding
   * it.
   */
  "kettlebell-swing": {
    bodyPitch: STANDING,
    durationSec: 1.5,
    base: {},
    camera: { position: [2.1, 1.0, 1.3], target: [0, 0.7, 0] },
    prop: { kind: "kettlebell" },
    keyframes: [
      {
        // Hike pass: hip hinge, arms swung back between the legs.
        t: 0,
        joints: {
          spine: { x: 52 }, head: { x: -18 },
          thighL: { x: -34 }, shinL: { x: 42 }, footL: { x: -8 },
          thighR: { x: -34 }, shinR: { x: 42 }, footR: { x: -8 },
          upperArmL: { x: -37 }, forearmL: { x: -6 },
          upperArmR: { x: -37 }, forearmR: { x: -6 },
        },
        contact: { point: "heelL", at: HEEL_L },
        ease: "in",
      },
      {
        // Top of the float: hips snapped open, arms carried up to chest
        // height by momentum alone — a standard Russian swing stops there,
        // not overhead (that is the American swing variant, a different
        // exercise this animation is not claiming to show).
        t: 0.5,
        joints: {
          spine: { x: 4 }, head: { x: 4 },
          thighL: { x: -4 }, shinL: { x: 8 }, footL: { x: -4 },
          thighR: { x: -4 }, shinR: { x: 8 }, footR: { x: -4 },
          upperArmL: { x: -78 }, forearmL: { x: -4 },
          upperArmR: { x: -78 }, forearmR: { x: -4 },
        },
        contact: { point: "heelL", at: HEEL_L },
        ease: "out",
      },
      {
        t: 1,
        joints: {
          spine: { x: 52 }, head: { x: -18 },
          thighL: { x: -34 }, shinL: { x: 42 }, footL: { x: -8 },
          thighR: { x: -34 }, shinR: { x: 42 }, footR: { x: -8 },
          upperArmL: { x: -37 }, forearmL: { x: -6 },
          upperArmR: { x: -37 }, forearmR: { x: -6 },
        },
        contact: { point: "heelL", at: HEEL_L },
      },
    ],
  },
};

export function findExercisePose(animationId: ExerciseAnimationId | null): ExercisePose | null {
  return animationId ? EXERCISE_POSES[animationId] ?? null : null;
}

// ── sampling ───────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Easing is applied to the segment's progress before any interpolation, so it
 * shapes the movement rather than just smoothing it. The old implementation
 * was linear everywhere, which gave every rep a constant speed and an
 * instantaneous reversal at the bottom.
 */
function applyEase(name: EaseName, t: number): number {
  switch (name) {
    case "linear":
      return t;
    case "in":
      return t * t;
    case "out":
      return 1 - (1 - t) * (1 - t);
    case "inOut":
    default:
      return t * t * (3 - 2 * t);
  }
}

function wrap(t: number): number {
  return ((t % 1) + 1) % 1;
}

/** Finds the keyframe pair surrounding wrapped time t and the local 0-1 progress between them. */
function findSegment(keyframes: PoseKeyframe[], t: number): [PoseKeyframe, PoseKeyframe, number] {
  let i = 0;
  while (i < keyframes.length - 1 && t > keyframes[i + 1].t) i++;
  const a = keyframes[i];
  const b = keyframes[Math.min(i + 1, keyframes.length - 1)];
  const span = b.t - a.t;
  return [a, b, span === 0 ? 0 : (t - a.t) / span];
}

function resolve(
  base: Partial<Record<JointName, JointRotation>>,
  kf: PoseKeyframe,
  joint: JointName
): JointRotation {
  return kf.joints[joint] ?? base[joint] ?? { x: 0, z: 0 };
}

export type Rotations = Record<JointName, JointRotation>;

/**
 * Interpolated joint rotations at an arbitrary point in the loop. `tRaw` wraps
 * automatically, so a frame counter can just keep counting up.
 *
 * Returns EVERY joint, always. The previous version omitted joints that
 * happened to interpolate to zero, which left the renderer holding a stale
 * rotation for them.
 */
export function samplePose(pose: ExercisePose, tRaw: number): Rotations {
  const [a, b, localT] = findSegment(pose.keyframes, wrap(tRaw));
  const e = applyEase(a.ease ?? "inOut", localT);

  const result = {} as Rotations;
  for (const joint of Object.keys(JOINT_DEFAULTS) as JointName[]) {
    const from = resolve(pose.base, a, joint);
    const to = resolve(pose.base, b, joint);
    result[joint] = {
      x: lerp(from.x ?? 0, to.x ?? 0, e),
      z: lerp(from.z ?? 0, to.z ?? 0, e),
    };
  }
  return result;
}

const JOINT_DEFAULTS: Record<JointName, JointRotation> = {
  hips: {}, spine: {}, head: {},
  upperArmL: {}, forearmL: {}, upperArmR: {}, forearmR: {},
  thighL: {}, shinL: {}, footL: {},
  thighR: {}, shinR: {}, footR: {},
};

export interface Frame {
  rotations: Rotations;
  /** Bone transforms with the root at the origin. */
  skeleton: Skeleton;
  /** Where the root must go so the declared contact lands on its surface. */
  root: Vec3;
}

/**
 * The full state of the figure at a point in the loop: angles, resolved
 * skeleton, and the derived root position.
 *
 * Both renderers call exactly this, which is what keeps the 2D and 3D views
 * describing the same movement instead of two hand-synced approximations.
 */
export function sampleFrame(pose: ExercisePose, tRaw: number): Frame {
  const t = wrap(tRaw);
  const [a, b, localT] = findSegment(pose.keyframes, t);
  const e = applyEase(a.ease ?? "inOut", localT);

  const rotations = samplePose(pose, t);
  const skeleton = solveSkeleton(rotations, pose.bodyPitch);

  let root: Vec3;
  if (a.contact.point === b.contact.point) {
    root = rootForContact(skeleton, a.contact.point, lerpVec(a.contact.at, b.contact.at, e));
  } else {
    // Weight transfer: both contacts are exactly satisfied at their own end of
    // the segment, and the root crosses over between them. Without this the
    // planted foot would jump the moment the anchor changed.
    const fromRoot = rootForContact(skeleton, a.contact.point, a.contact.at);
    const toRoot = rootForContact(skeleton, b.contact.point, b.contact.at);
    root = lerpVec(fromRoot, toRoot, e);
  }

  return { rotations, skeleton, root };
}
