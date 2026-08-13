/**
 * Flattens the solved 3D figure into 2D drawing primitives.
 *
 * Lives here rather than inside exercise-rig.tsx so the projection can be
 * exercised without a DOM or a WebGL context — which is what makes it
 * possible to actually LOOK at every pose from a test, instead of only
 * asserting numbers about it.
 */

import { BONES, type Vec3 } from "./rig-skeleton";
import { addVec, type Skeleton } from "./rig-kinematics";
import { sampleFrame, type ExercisePose } from "./exercise-poses";

export const VIEW_W = 200;
export const VIEW_H = 260;
const PADDING = 14;

export interface Projector {
  /** World point -> unscaled screen point, y already flipped for SVG. */
  project: (p: Vec3) => [number, number];
  /** Distance from the viewer, for painter's-algorithm ordering. */
  depth: (p: Vec3) => number;
}

/**
 * Screen-space projection for a camera orbiting the Y axis. A camera
 * dominated by X looks along the sagittal plane (screen right is -Z); one
 * dominated by Z looks at the figure head-on (screen right is +X). That keeps
 * each exercise's 2D view on the same plane its 3D camera was framed for —
 * a lateral band walk seen from the side would show almost nothing.
 */
export function makeProjector(camera: Vec3): Projector {
  const front = Math.abs(camera[2]) > Math.abs(camera[0]);
  const sx = front ? Math.sign(camera[2]) || 1 : -(Math.sign(camera[0]) || 1);
  const sd = Math.sign((front ? camera[2] : camera[0]) || 1);
  return {
    project: (p) => (front ? [sx * p[0], -p[1]] : [sx * p[2], -p[1]]),
    depth: (p) => -(front ? p[2] : p[0]) * sd,
  };
}

export interface FitTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fits the whole loop into the viewBox once, so the figure doesn't rescale mid-rep. */
export function fitTransform(pose: ExercisePose, projector: Projector): FitTransform {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const note = (p: Vec3) => {
    const [x, y] = projector.project(p);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };

  for (let i = 0; i <= 48; i++) {
    const frame = sampleFrame(pose, i / 48);
    for (const bone of BONES) {
      note(addVec(frame.root, frame.skeleton[bone.name].p));
      note(addVec(frame.root, frame.skeleton[bone.name].tip));
    }
  }
  note([0, 0, 0]); // the floor is always in shot
  if (pose.prop?.kind === "box") {
    const { center, width, height, depth } = pose.prop;
    for (const dx of [-width / 2, width / 2])
      for (const dy of [-height / 2, height / 2])
        for (const dz of [-depth / 2, depth / 2])
          note([center[0] + dx, center[1] + dy, center[2] + dz]);
  }

  // Head radius and limb thickness sit outside the joint positions.
  const margin = 0.16;
  minX -= margin; maxX += margin; minY -= margin; maxY += margin;

  const scale = Math.min((VIEW_W - PADDING * 2) / (maxX - minX), (VIEW_H - PADDING * 2) / (maxY - minY));
  return {
    scale,
    offsetX: (VIEW_W - (maxX - minX) * scale) / 2 - minX * scale,
    offsetY: (VIEW_H - (maxY - minY) * scale) / 2 - minY * scale,
  };
}

export interface Segment {
  key: string;
  depth: number;
  kind: "limb" | "head";
  x1: number; y1: number; x2: number; y2: number;
  width: number;
  radius?: number;
}

export function buildSegments(
  skeleton: Skeleton,
  root: Vec3,
  projector: Projector,
  fit: FitTransform
): Segment[] {
  const to = (p: Vec3): [number, number] => {
    const [x, y] = projector.project(p);
    return [x * fit.scale + fit.offsetX, y * fit.scale + fit.offsetY];
  };

  const segments: Segment[] = [];

  for (const bone of BONES) {
    const solved = skeleton[bone.name];
    const joint = addVec(root, solved.p);
    const tip = addVec(root, solved.tip);
    const mid: Vec3 = [(joint[0] + tip[0]) / 2, (joint[1] + tip[1]) / 2, (joint[2] + tip[2]) / 2];

    if (bone.name === "hips") {
      // Drawn as a bar across the two hip joints rather than a box, which is
      // what a pelvis reads as in a flat view.
      const [lx, ly] = to(addVec(root, skeleton.thighL.p));
      const [rx, ry] = to(addVec(root, skeleton.thighR.p));
      segments.push({
        key: "hips", kind: "limb", depth: projector.depth(mid),
        x1: lx, y1: ly, x2: rx, y2: ry, width: 0.17 * fit.scale,
      });
      continue;
    }

    const [x1, y1] = to(joint);
    const [x2, y2] = to(tip);

    if (bone.shape === "sphere") {
      segments.push({
        key: `${bone.name}-neck`, kind: "limb", depth: projector.depth(mid),
        x1, y1, x2, y2, width: 0.09 * fit.scale,
      });
      segments.push({
        key: bone.name, kind: "head", depth: projector.depth(tip),
        x1: x2, y1: y2, x2, y2, width: 0, radius: bone.radius * fit.scale,
      });
      continue;
    }

    const [ox, oy, oz] = bone.meshOffset ?? [0, 0, 0];
    const [sx, sy] = to([joint[0] + ox, joint[1] + oy, joint[2] + oz]);
    const dx = sx - x1, dy = sy - y1;
    segments.push({
      key: bone.name, kind: "limb", depth: projector.depth(mid),
      x1: x1 + dx, y1: y1 + dy, x2: x2 + dx, y2: y2 + dy,
      width: bone.radius * 2 * fit.scale,
    });
  }

  // Painter's algorithm: far limbs first, so a near arm overlaps the torso
  // rather than the other way round.
  return segments.sort((a, b) => b.depth - a.depth);
}

/** Screen y of the ground plane. */
export function floorY(fit: FitTransform): number {
  return fit.offsetY;
}

export interface BoxRect { x: number; y: number; width: number; height: number }

/**
 * Projects all EIGHT corners, not two.
 *
 * Varying only x and y collapses the rect to zero width in a side view, where
 * the horizontal screen axis comes from z — which silently drew no box at all
 * and left the step-up rising onto thin air.
 */
export function boxRect(
  prop: Extract<ExercisePose["prop"], { kind: "box" }>,
  projector: Projector,
  fit: FitTransform
): BoxRect {
  const { center, width, height, depth } = prop;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const dx of [-width / 2, width / 2])
    for (const dy of [-height / 2, height / 2])
      for (const dz of [-depth / 2, depth / 2]) {
        const [x, y] = projector.project([center[0] + dx, center[1] + dy, center[2] + dz]);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
  return {
    x: minX * fit.scale + fit.offsetX,
    y: minY * fit.scale + fit.offsetY,
    width: (maxX - minX) * fit.scale,
    height: (maxY - minY) * fit.scale,
  };
}
