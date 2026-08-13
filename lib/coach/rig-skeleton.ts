/**
 * The single definition of the demonstration figure's body.
 *
 * Both renderers are built FROM this list rather than each declaring their own
 * limb sizes: exercise-model-3d.tsx walks it to build the THREE.Group
 * hierarchy, exercise-rig.tsx walks it to draw the SVG. The previous pass kept
 * the 3D capsule sizes in the R3F component and the 2D proportions in
 * hand-drawn SVG paths, which is why the two views could — and did — disagree
 * about the same movement.
 *
 * Units are metres; the figure is ~1.75 m standing.
 *
 * FRAME CONVENTION
 *   +Y up, +Z is the direction the figure faces, +X is its left.
 *   A bone's rotation is applied at its own origin (the joint), so a rotation
 *   always bends at the anatomically correct point.
 *
 * ANGLE CONVENTION (degrees, rotation about X unless noted)
 *   Negative x swings a downward-hanging limb FORWARD (+Z), positive swings it
 *   back. So hip/shoulder flexion is negative, knee flexion is positive
 *   (the shin folds back under the thigh), and ankle plantarflexion — heel
 *   rising, the calf-raise movement — is positive.
 *   z is used only for genuinely lateral motion (hip abduction).
 */

export type JointName =
  | "hips"
  | "spine"
  | "head"
  | "upperArmL"
  | "forearmL"
  | "upperArmR"
  | "forearmR"
  | "thighL"
  | "shinL"
  | "footL"
  | "thighR"
  | "shinR"
  | "footR";

export type Vec3 = [number, number, number];

/** Pitch (x), and — only for genuinely lateral motion — abduction (z), in degrees. */
export interface JointRotation {
  x?: number;
  z?: number;
}

export interface Bone {
  name: JointName;
  /** null attaches the bone directly to the root. */
  parent: JointName | null;
  /** Joint position in the parent's local frame. */
  offset: Vec3;
  /** Unit direction the drawn segment extends from its joint. */
  dir: Vec3;
  /** Segment length along `dir`. 0 for the hips block and the head. */
  length: number;
  radius: number;
  shape: "capsule" | "box" | "sphere";
  /** Box dimensions, only for `shape: "box"`. */
  size?: Vec3;
  /**
   * Shifts the DRAWN segment without moving the joint it rotates about.
   * The foot needs this: its capsule is thinner than the ankle is tall, so
   * the sole has to be dropped to meet the heel/ball contact points — which
   * are the things that actually have to touch the floor.
   */
  meshOffset?: Vec3;
}

const DOWN: Vec3 = [0, -1, 0];
const UP: Vec3 = [0, 1, 0];
const FWD: Vec3 = [0, 0, 1];

export const THIGH_LENGTH = 0.42;
export const SHIN_LENGTH = 0.4;
export const UPPER_ARM_LENGTH = 0.28;
export const FOREARM_LENGTH = 0.26;
export const TORSO_LENGTH = 0.46;
/** Neck joint to the centre of the skull. */
export const NECK_LENGTH = 0.175;
/** Ankle joint height above the sole — the foot's thickness. */
export const ANKLE_HEIGHT = 0.07;
/**
 * Heel sits slightly behind the ankle, the ball well in front of it. The
 * drawn foot ends AT the ball rather than overshooting it: a rigid foot with
 * toes past its contact point drives them through the floor as soon as it
 * plantarflexes, which is exactly what a calf raise does.
 */
export const HEEL_Z = -0.05;
export const BALL_Z = 0.11;
/** Half the distance between the two hip joints. */
export const HIP_HALF_WIDTH = 0.09;

/**
 * Ordered parents-before-children, which lets the solver do a single forward
 * pass instead of recursing.
 */
export const BONES: Bone[] = [
  { name: "hips", parent: null, offset: [0, 0, 0], dir: UP, length: 0, radius: 0.09, shape: "box", size: [0.28, 0.17, 0.19] },

  { name: "spine", parent: "hips", offset: [0, 0.075, 0], dir: UP, length: TORSO_LENGTH, radius: 0.145, shape: "capsule" },
  // `head` is really the NECK joint, with the skull drawn at the far end of a
  // short neck rather than sitting on the joint itself. That distinction
  // matters: a sphere pinned to its own joint cannot be moved by its own
  // rotation, so there was no way to keep the head off the floor during the
  // glute bridge — tilting the torso to raise the hips drove the skull 61 mm
  // underground no matter what `head.x` was set to. With a neck, head.x is a
  // real chin tuck.
  { name: "head", parent: "spine", offset: [0, TORSO_LENGTH, 0], dir: UP, length: NECK_LENGTH, radius: 0.115, shape: "sphere" },

  { name: "upperArmL", parent: "spine", offset: [-0.19, TORSO_LENGTH - 0.04, 0], dir: DOWN, length: UPPER_ARM_LENGTH, radius: 0.055, shape: "capsule" },
  { name: "forearmL", parent: "upperArmL", offset: [0, -UPPER_ARM_LENGTH, 0], dir: DOWN, length: FOREARM_LENGTH, radius: 0.047, shape: "capsule" },
  { name: "upperArmR", parent: "spine", offset: [0.19, TORSO_LENGTH - 0.04, 0], dir: DOWN, length: UPPER_ARM_LENGTH, radius: 0.055, shape: "capsule" },
  { name: "forearmR", parent: "upperArmR", offset: [0, -UPPER_ARM_LENGTH, 0], dir: DOWN, length: FOREARM_LENGTH, radius: 0.047, shape: "capsule" },

  { name: "thighL", parent: "hips", offset: [-HIP_HALF_WIDTH, -0.06, 0], dir: DOWN, length: THIGH_LENGTH, radius: 0.078, shape: "capsule" },
  { name: "shinL", parent: "thighL", offset: [0, -THIGH_LENGTH, 0], dir: DOWN, length: SHIN_LENGTH, radius: 0.062, shape: "capsule" },
  { name: "footL", parent: "shinL", offset: [0, -SHIN_LENGTH, 0], dir: FWD, length: BALL_Z - HEEL_Z, radius: 0.045, shape: "capsule", meshOffset: [0, -(ANKLE_HEIGHT - 0.045), HEEL_Z] },

  { name: "thighR", parent: "hips", offset: [HIP_HALF_WIDTH, -0.06, 0], dir: DOWN, length: THIGH_LENGTH, radius: 0.078, shape: "capsule" },
  { name: "shinR", parent: "thighR", offset: [0, -THIGH_LENGTH, 0], dir: DOWN, length: SHIN_LENGTH, radius: 0.062, shape: "capsule" },
  { name: "footR", parent: "shinR", offset: [0, -SHIN_LENGTH, 0], dir: FWD, length: BALL_Z - HEEL_Z, radius: 0.045, shape: "capsule", meshOffset: [0, -(ANKLE_HEIGHT - 0.045), HEEL_Z] },
];

export const JOINT_NAMES: JointName[] = BONES.map((b) => b.name);

/**
 * Named points on the body that can be planted on a surface.
 *
 * This is the concept the previous implementation was missing entirely. Every
 * exercise in this set is anchored by something touching the ground — the
 * anchor is what stays still while the body moves around it — so a pose has to
 * be able to NAME that point. `bone` + `local` is enough for the solver to
 * find it in world space at any frame.
 */
export type ContactPointName =
  | "heelL" | "ballL" | "heelR" | "ballR"
  | "upperBack" | "sacrum";

export const CONTACT_POINTS: Record<ContactPointName, { bone: JointName; local: Vec3 }> = {
  heelL: { bone: "footL", local: [0, -ANKLE_HEIGHT, HEEL_Z] },
  ballL: { bone: "footL", local: [0, -ANKLE_HEIGHT, BALL_Z] },
  heelR: { bone: "footR", local: [0, -ANKLE_HEIGHT, HEEL_Z] },
  ballR: { bone: "footR", local: [0, -ANKLE_HEIGHT, BALL_Z] },
  /** Between the shoulder blades — what a glute bridge actually pivots on. */
  upperBack: { bone: "spine", local: [0, TORSO_LENGTH - 0.06, -0.145] },
  sacrum: { bone: "hips", local: [0, 0, -0.095] },
};
