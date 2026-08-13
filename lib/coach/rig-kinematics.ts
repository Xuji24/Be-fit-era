/**
 * Forward kinematics for the demonstration figure, plus the contact solver
 * that positions it in the world.
 *
 * WHY THIS EXISTS
 * The previous implementation rooted the skeleton at the hips and placed it
 * with a hand-tuned per-keyframe `liftY`. That cannot work, and the failure is
 * arithmetic rather than a matter of tuning: foot height is a trigonometric
 * function of the joint angles, so linearly interpolating angles does not
 * linearly interpolate foot height. A per-keyframe constant can be tuned to
 * land correctly AT the keyframes and is necessarily wrong everywhere between
 * them. Measured on the old data, squat's feet sank 78 mm through the floor
 * mid-descent while being correct to within 4 mm at both keyframes; the glute
 * bridge floated a full metre off the ground.
 *
 * WHAT REPLACES IT
 * The root position is DERIVED, never authored. A pose declares which point of
 * the body is planted and where that point sits in the world; the solver runs
 * FK with the root at the origin, finds where the planted point landed, and
 * translates the root by the difference. The contact is then exact on every
 * frame by construction, including interpolated ones. There is no `liftY` to
 * tune and no way for a foot to drift.
 *
 * This module is deliberately framework-free — no three.js — because both the
 * 3D and 2D renderers consume it, and because it makes the kinematics
 * unit-testable without a WebGL context.
 *
 * Rotation order matches three.js's default Euler 'XYZ' (R = Rx · Ry · Rz)
 * with y unused, so driving Object3D.rotation from the same angles produces
 * exactly the transforms computed here.
 */

import {
  BONES,
  CONTACT_POINTS,
  type Bone,
  type ContactPointName,
  type JointName,
  type JointRotation,
  type Vec3,
} from "./rig-skeleton";

const DEG = Math.PI / 180;

/** Row-major 3x3. */
type Mat3 = [number, number, number, number, number, number, number, number, number];

function multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9) as Mat3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return out;
}

function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Rx(x) · Rz(z), matching three.js Euler order 'XYZ' with y = 0. */
function rotationXZ(xDeg: number, zDeg: number): Mat3 {
  const x = xDeg * DEG;
  const z = zDeg * DEG;
  const cx = Math.cos(x), sx = Math.sin(x);
  const cz = Math.cos(z), sz = Math.sin(z);
  // Rx = [1,0,0, 0,cx,-sx, 0,sx,cx]   Rz = [cz,-sz,0, sz,cz,0, 0,0,1]
  return [
    cz, -sz, 0,
    cx * sz, cx * cz, -sx,
    sx * sz, sx * cz, cx,
  ];
}

export function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A bone's resolved world orientation and joint position, root at the origin. */
export interface SolvedBone {
  /** World rotation, for orienting the drawn segment. */
  m: Mat3;
  /** World position of the JOINT this bone rotates about. */
  p: Vec3;
  /** World position of the segment's far end — the child joint. */
  tip: Vec3;
}

export type Skeleton = Record<JointName, SolvedBone>;

const BONE_BY_NAME = new Map<JointName, Bone>(BONES.map((b) => [b.name, b]));

/**
 * Resolves every bone's world transform with the root at the origin.
 *
 * `bodyPitch` reorients the whole figure before any joint rotation — it is how
 * a floor exercise lies down. Unlike the previous implementation, lying down
 * does not also mean floating: the contact solver puts the body back on the
 * ground afterwards.
 */
export function solveSkeleton(
  rotations: Partial<Record<JointName, JointRotation>>,
  bodyPitch = 0
): Skeleton {
  const rootM = rotationXZ(bodyPitch, 0);
  const solved = {} as Skeleton;

  for (const bone of BONES) {
    const parent = bone.parent ? solved[bone.parent] : { m: rootM, p: [0, 0, 0] as Vec3, tip: [0, 0, 0] as Vec3 };
    const rot = rotations[bone.name];
    const local = rotationXZ(rot?.x ?? 0, rot?.z ?? 0);

    const p = addVec(parent.p, apply(parent.m, bone.offset));
    const m = multiply(parent.m, local);
    const tip = addVec(p, apply(m, [bone.dir[0] * bone.length, bone.dir[1] * bone.length, bone.dir[2] * bone.length]));

    solved[bone.name] = { m, p, tip };
  }

  return solved;
}

/** World position of a named contact point, root at the origin. */
export function contactPosition(skeleton: Skeleton, name: ContactPointName): Vec3 {
  const { bone, local } = CONTACT_POINTS[name];
  const b = skeleton[bone];
  return addVec(b.p, apply(b.m, local));
}

/** World position of an arbitrary point in a bone's local frame. */
export function localToWorld(skeleton: Skeleton, bone: JointName, local: Vec3): Vec3 {
  const b = skeleton[bone];
  return addVec(b.p, apply(b.m, local));
}

/**
 * The root translation that puts `point` exactly at `at`.
 *
 * This is the whole fix in one line: the figure is placed by where it touches
 * the world, not by a number someone guessed.
 */
export function rootForContact(skeleton: Skeleton, point: ContactPointName, at: Vec3): Vec3 {
  return subVec(at, contactPosition(skeleton, point));
}

/** Segment radius lookup, so renderers don't re-declare limb thicknesses. */
export function boneOf(name: JointName): Bone {
  const bone = BONE_BY_NAME.get(name);
  if (!bone) throw new Error(`Unknown bone: ${name}`);
  return bone;
}
