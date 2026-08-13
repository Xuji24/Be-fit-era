import { describe, it, expect } from "vitest";
import {
  EXERCISE_POSES,
  findExercisePose,
  samplePose,
  sampleFrame,
  type ExercisePose,
} from "@/lib/coach/exercise-poses";
import {
  BONES,
  JOINT_NAMES,
  CONTACT_POINTS,
  type ContactPointName,
  type JointName,
  type Vec3,
} from "@/lib/coach/rig-skeleton";
import { solveSkeleton, contactPosition, addVec } from "@/lib/coach/rig-kinematics";
import { findAnimationId } from "@/lib/coach/exercise-animations";
import {
  makeProjector,
  fitTransform,
  buildSegments,
  boxRect,
  VIEW_W,
  VIEW_H,
} from "@/lib/coach/rig-projection";

const ANIMATION_IDS = Object.keys(EXERCISE_POSES) as (keyof typeof EXERCISE_POSES)[];
const JOINT_SET = new Set<string>(JOINT_NAMES);
const FOOT_POINTS: ContactPointName[] = ["heelL", "ballL", "heelR", "ballR"];

/** World position of a contact point at time t, root offset included. */
function pointAt(pose: ExercisePose, t: number, p: ContactPointName): Vec3 {
  const f = sampleFrame(pose, t);
  return addVec(f.root, contactPosition(f.skeleton, p));
}

function samples(count = 160): number[] {
  return Array.from({ length: count + 1 }, (_, i) => i / count);
}

describe("EXERCISE_POSES coverage", () => {
  it("covers every exercise the animation table can resolve", () => {
    for (const name of [
      "Squat", "Lunges", "Calf raises", "High knees", "Glute bridge",
      "Step-up", "Single-leg RDL", "Lateral band walk",
    ]) {
      const id = findAnimationId(name);
      expect(id, `${name} should map to an animation`).not.toBeNull();
      expect(findExercisePose(id), `${name} should have a pose`).not.toBeNull();
    }
  });

  it("keeps keyframe times ordered, within [0,1], and spanning the whole loop", () => {
    for (const id of ANIMATION_IDS) {
      const times = EXERCISE_POSES[id].keyframes.map((k) => k.t);
      expect(times[0], `${id} first keyframe`).toBe(0);
      expect(times[times.length - 1], `${id} last keyframe`).toBe(1);
      for (let i = 1; i < times.length; i++) {
        expect(times[i], `${id} keyframe order`).toBeGreaterThan(times[i - 1]);
      }
    }
  });

  it("loops seamlessly — the last keyframe's joint pose matches the first", () => {
    for (const id of ANIMATION_IDS) {
      const { keyframes } = EXERCISE_POSES[id];
      expect(keyframes[keyframes.length - 1].joints, id).toEqual(keyframes[0].joints);
      expect(keyframes[keyframes.length - 1].contact, `${id} closing contact`).toEqual(keyframes[0].contact);
    }
  });

  it("only ever references known joints and contact points", () => {
    for (const id of ANIMATION_IDS) {
      for (const kf of EXERCISE_POSES[id].keyframes) {
        for (const joint of Object.keys(kf.joints)) {
          expect(JOINT_SET.has(joint), `${id} references unknown joint "${joint}"`).toBe(true);
        }
        expect(CONTACT_POINTS[kf.contact.point], `${id} unknown contact "${kf.contact.point}"`).toBeDefined();
      }
      for (const joint of Object.keys(EXERCISE_POSES[id].base)) {
        expect(JOINT_SET.has(joint), `${id} base references unknown joint "${joint}"`).toBe(true);
      }
    }
  });

  it("keeps every joint rotation within a plausible human range", () => {
    for (const id of ANIMATION_IDS) {
      for (const kf of EXERCISE_POSES[id].keyframes) {
        for (const [joint, rot] of Object.entries(kf.joints) as [JointName, { x?: number; z?: number }][]) {
          if (rot.x !== undefined) expect(Math.abs(rot.x), `${id}.${joint}.x`).toBeLessThanOrEqual(180);
          if (rot.z !== undefined) expect(Math.abs(rot.z), `${id}.${joint}.z`).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it("gives every exercise a positive loop duration and a camera", () => {
    for (const id of ANIMATION_IDS) {
      expect(EXERCISE_POSES[id].durationSec, id).toBeGreaterThan(0);
      expect(EXERCISE_POSES[id].camera.position, `${id} camera`).toHaveLength(3);
    }
  });

  it("only reorients the whole body for genuinely floor exercises", () => {
    const nonStanding = new Set(["glute-bridge"]);
    for (const id of ANIMATION_IDS) {
      expect(EXERCISE_POSES[id].bodyPitch !== 0, id).toBe(nonStanding.has(id));
    }
  });
});

/**
 * The invariants that actually matter, and the ones the previous suite had
 * none of: it passed in full while the glute bridge floated a metre off the
 * ground and squat's feet sank 78 mm through the floor. Structure was never
 * the problem.
 */
describe("ground contact", () => {
  it("holds each declared anchor perfectly still while it is the anchor", () => {
    for (const id of ANIMATION_IDS) {
      const pose = EXERCISE_POSES[id];
      for (let i = 0; i < pose.keyframes.length - 1; i++) {
        const a = pose.keyframes[i];
        const b = pose.keyframes[i + 1];
        // A segment that changes contact is a weight transfer; the foot is
        // allowed to move across it.
        if (a.contact.point !== b.contact.point) continue;
        for (let s = 0; s <= 24; s++) {
          const t = a.t + ((b.t - a.t) * s) / 24;
          const p = pointAt(pose, t, a.contact.point);
          const slip = Math.hypot(
            p[0] - a.contact.at[0],
            p[1] - a.contact.at[1],
            p[2] - a.contact.at[2]
          );
          expect(slip, `${id}: ${a.contact.point} slipped at t=${t.toFixed(3)}`).toBeLessThan(0.003);
        }
      }
    }
  });

  it("never drives a foot, limb or head through the floor", () => {
    for (const id of ANIMATION_IDS) {
      const pose = EXERCISE_POSES[id];
      for (const t of samples()) {
        const f = sampleFrame(pose, t);
        for (const p of FOOT_POINTS) {
          const y = addVec(f.root, contactPosition(f.skeleton, p))[1];
          expect(y, `${id}: ${p} below the floor at t=${t.toFixed(3)}`).toBeGreaterThan(-0.008);
        }
        for (const bone of ["shinL", "shinR", "thighL", "thighR", "forearmL", "forearmR"] as const) {
          const y = addVec(f.root, f.skeleton[bone].tip)[1];
          expect(y, `${id}: ${bone} below the floor at t=${t.toFixed(3)}`).toBeGreaterThan(-0.008);
        }
        const headBottom = addVec(f.root, f.skeleton.head.tip)[1] - 0.115;
        expect(headBottom, `${id}: head below the floor at t=${t.toFixed(3)}`).toBeGreaterThan(-0.008);
      }
    }
  });

  it("never lets a foot pass through a prop the exercise stands on", () => {
    for (const id of ANIMATION_IDS) {
      const pose = EXERCISE_POSES[id];
      if (pose.prop?.kind !== "box") continue;
      const { width, height, depth, center } = pose.prop;
      for (const t of samples()) {
        const f = sampleFrame(pose, t);
        for (const p of FOOT_POINTS) {
          const w = addVec(f.root, contactPosition(f.skeleton, p));
          const insideFootprint =
            Math.abs(w[0] - center[0]) < width / 2 && Math.abs(w[2] - center[2]) < depth / 2;
          if (!insideFootprint) continue;
          expect(w[1], `${id}: ${p} inside the box at t=${t.toFixed(3)}`).toBeGreaterThan(height - 0.01);
        }
      }
    }
  });

  it("stands the neutral figure on the floor with a plausible human height", () => {
    const f = sampleFrame(EXERCISE_POSES.squat, 0);
    for (const p of FOOT_POINTS) {
      expect(Math.abs(addVec(f.root, contactPosition(f.skeleton, p))[1]), p).toBeLessThan(0.002);
    }
    const top = addVec(f.root, f.skeleton.head.tip)[1] + 0.115;
    expect(top).toBeGreaterThan(1.6);
    expect(top).toBeLessThan(1.95);
  });
});

describe("motion continuity", () => {
  it("closes the loop without a positional jump", () => {
    for (const id of ANIMATION_IDS) {
      const pose = EXERCISE_POSES[id];
      const d = 1 / 2000;
      const before = sampleFrame(pose, 1 - d).root;
      const at0 = sampleFrame(pose, 0).root;
      const jump = Math.hypot(...at0.map((v, i) => v - before[i]));
      expect(jump, `${id} loop seam`).toBeLessThan(0.002);
    }
  });

  it("never teleports the figure between two rendered frames", () => {
    for (const id of ANIMATION_IDS) {
      const pose = EXERCISE_POSES[id];
      const frames = Math.round(pose.durationSec * 60);
      let prev = sampleFrame(pose, 0).root;
      for (let i = 1; i <= frames; i++) {
        const r = sampleFrame(pose, i / frames).root;
        const step = Math.hypot(...r.map((v, k) => v - prev[k]));
        expect(step, `${id} jumped at t=${(i / frames).toFixed(3)}`).toBeLessThan(0.04);
        prev = r;
      }
    }
  });

  it("eases rather than running at a constant speed", () => {
    // A squat should be slowest at the turnaround and quickest mid-rep. With
    // the old linear interpolation these were identical.
    const pose = EXERCISE_POSES.squat;
    const speed = (t: number) => {
      const d = 1e-4;
      const a = sampleFrame(pose, t - d).root[1];
      const b = sampleFrame(pose, t + d).root[1];
      return Math.abs(b - a) / (2 * d);
    };
    expect(speed(0.275)).toBeGreaterThan(speed(0.02) * 3);
  });
});

describe("samplePose", () => {
  it("matches the keyframe's rotation values exactly at its own time", () => {
    const squat = EXERCISE_POSES.squat;
    const sample = samplePose(squat, 0.55);
    for (const [joint, rot] of Object.entries(squat.keyframes[1].joints)) {
      expect(sample[joint as JointName]?.x, joint).toBeCloseTo(rot!.x ?? 0, 5);
    }
  });

  it("returns a value for every joint, never a partial pose", () => {
    // The old sampler omitted joints that interpolated to zero, which left
    // the renderer holding a stale rotation for them.
    for (const id of ANIMATION_IDS) {
      for (const t of [0, 0.13, 0.5, 0.77, 1]) {
        const sample = samplePose(EXERCISE_POSES[id], t);
        for (const joint of JOINT_NAMES) {
          expect(sample[joint], `${id}.${joint} at t=${t}`).toBeDefined();
          expect(Number.isFinite(sample[joint].x), `${id}.${joint}.x finite`).toBe(true);
        }
      }
    }
  });

  it("falls back to the exercise's explicit base pose, not an implicit zero", () => {
    const walk = EXERCISE_POSES["lateral-band-walk"];
    // The quarter-squat is held in `base` and never restated per keyframe.
    expect(samplePose(walk, 0).shinL.x).toBeCloseTo(walk.base.shinL!.x!, 5);
    expect(samplePose(walk, 0.5).shinR.x).toBeCloseTo(walk.base.shinR!.x!, 5);
  });

  it("wraps time outside [0,1] back into the loop", () => {
    const squat = EXERCISE_POSES.squat;
    expect(samplePose(squat, 1.55)).toEqual(samplePose(squat, 0.55));
    expect(samplePose(squat, -0.45)).toEqual(samplePose(squat, 0.55));
  });

  it("resolves single-leg-rdl's working leg independently of the stance leg", () => {
    const peak = samplePose(EXERCISE_POSES["single-leg-rdl"], 0.5);
    expect(peak.thighL.x!).not.toBeCloseTo(peak.thighR.x!, 1);
  });

  it("resolves lateral-band-walk's abduction on the z axis", () => {
    const peak = samplePose(EXERCISE_POSES["lateral-band-walk"], 0.22);
    expect(peak.thighL.z).toBeLessThan(0);
    expect(peak.thighR.z).toBeGreaterThan(0);
  });
});

describe("exercise mechanics", () => {
  it("drops the hips and drives them backward in a squat", () => {
    const pose = EXERCISE_POSES.squat;
    const top = sampleFrame(pose, 0);
    const bottom = sampleFrame(pose, 0.55);
    const hipTop = addVec(top.root, top.skeleton.hips.p);
    const hipBottom = addVec(bottom.root, bottom.skeleton.hips.p);
    expect(hipTop[1] - hipBottom[1], "hip drop").toBeGreaterThan(0.3);
    // "Push your hips back as if sitting into a chair behind you."
    expect(hipBottom[2], "hips travel back").toBeLessThan(hipTop[2] - 0.1);
  });

  it("lifts the heels on a calf raise while the balls stay planted", () => {
    const pose = EXERCISE_POSES["calf-raise"];
    const bottom = pointAt(pose, 0, "heelL");
    const top = pointAt(pose, 0.4, "heelL");
    expect(top[1] - bottom[1], "heel lift").toBeGreaterThan(0.08);
    expect(Math.abs(pointAt(pose, 0.4, "ballL")[1]), "ball stays down").toBeLessThan(0.003);
  });

  it("keeps the glute bridge's feet planted and shoulders down while the hips rise", () => {
    const pose = EXERCISE_POSES["glute-bridge"];
    const down = sampleFrame(pose, 0);
    const up = sampleFrame(pose, 0.45);
    const hipDown = addVec(down.root, down.skeleton.hips.p)[1];
    const hipUp = addVec(up.root, up.skeleton.hips.p)[1];
    expect(hipUp - hipDown, "hip rise").toBeGreaterThan(0.1);

    for (const t of samples(60)) {
      // "Keep your feet planted" — no drift in any axis, not just height.
      //
      // The bridge anchors the upper back, so the feet are derived rather
      // than pinned, and interpolating between solved poses leaves a small
      // residual: ~5 mm here, from the same "angles interpolate, positions
      // don't" effect that produced metre-scale errors before. Solved
      // midpoints at t=0.22/0.82 cut it 4x; the bound below is where it is
      // because 8 mm on a 1.7 m figure is under half a percent of body
      // height and invisible at any render size we use, not because it is
      // what happened to pass.
      const heel = pointAt(pose, t, "heelL");
      const ref = pointAt(pose, 0, "heelL");
      expect(Math.hypot(...heel.map((v, i) => v - ref[i])), `heel moved at t=${t}`).toBeLessThan(0.008);
      expect(Math.abs(pointAt(pose, t, "upperBack")[1]), "shoulders left the floor").toBeLessThan(0.003);
    }
  });

  it("raises the drive knee to hip height on high knees", () => {
    const f = sampleFrame(EXERCISE_POSES["high-knees"], 0);
    const knee = addVec(f.root, f.skeleton.shinL.p)[1];
    const hip = addVec(f.root, f.skeleton.thighL.p)[1];
    expect(knee).toBeGreaterThan(hip - 0.06);
  });

  it("stands the step-up all the way up onto the box", () => {
    const pose = EXERCISE_POSES["step-up"];
    const box = pose.prop as Extract<typeof pose.prop, { kind: "box" }>;
    const floor = sampleFrame(pose, 0);
    const onBox = sampleFrame(pose, 0.55);
    const rise = addVec(onBox.root, onBox.skeleton.hips.p)[1] - addVec(floor.root, floor.skeleton.hips.p)[1];
    expect(rise, "should rise by about the box height").toBeGreaterThan(box.height * 0.85);
    expect(Math.abs(pointAt(pose, 0.55, "heelL")[1] - box.height), "lead heel on the box top").toBeLessThan(0.003);
  });

  it("hinges the RDL torso toward horizontal over a near-straight stance leg", () => {
    const pose = EXERCISE_POSES["single-leg-rdl"];
    const bottom = pose.keyframes[1];
    expect(bottom.joints.spine!.x!, "torso hinge").toBeGreaterThan(70);
    expect(bottom.joints.shinL!.x!, "stance knee stays soft, not squatting").toBeLessThan(35);
    // The free leg counterbalances behind, rather than trailing loose.
    expect(bottom.joints.thighR!.x!, "free leg extends back").toBeGreaterThan(90);
  });

  it("travels sideways and returns on a band walk, holding the quarter-squat", () => {
    const pose = EXERCISE_POSES["lateral-band-walk"];
    const xs = samples(80).map((t) => sampleFrame(pose, t).root[0]);
    expect(Math.max(...xs) - Math.min(...xs), "lateral travel").toBeGreaterThan(0.1);
    expect(Math.abs(xs[0] - xs[xs.length - 1]), "returns to where it started").toBeLessThan(0.003);
    for (const t of samples(40)) {
      // "Stay low — standing up tall takes the work out of your hips."
      expect(samplePose(pose, t).shinL.x!, `stood up at t=${t}`).toBeGreaterThan(20);
    }
  });
});

describe("rig skeleton", () => {
  it("lists every bone's parent before the bone itself", () => {
    const seen = new Set<JointName>();
    for (const bone of BONES) {
      if (bone.parent) expect(seen.has(bone.parent), `${bone.name} before its parent`).toBe(true);
      seen.add(bone.name);
    }
  });

  it("resolves a rest skeleton with the feet below the head", () => {
    const rest = solveSkeleton({} as Record<JointName, { x: number; z: number }>, 0);
    expect(rest.footL.p[1]).toBeLessThan(rest.head.tip[1]);
    expect(rest.thighL.p[0]).toBeLessThan(rest.thighR.p[0]);
  });
});

/**
 * The projection is where two bugs hid that no amount of pose-data checking
 * would have caught, because both were about DRAWING a correct pose wrongly.
 */
describe("2D projection", () => {
  it("gives a box real width in a side view", () => {
    // boxRect used to vary only x and y. In a side view the horizontal screen
    // axis comes from z, so the step-up's box collapsed to zero width and
    // simply wasn't drawn — the figure rose onto nothing.
    const pose = EXERCISE_POSES["step-up"];
    const prop = pose.prop as Extract<typeof pose.prop, { kind: "box" }>;
    const projector = makeProjector(pose.camera.position);
    const fit = fitTransform(pose, projector);
    const rect = boxRect(prop, projector, fit);
    expect(rect.width).toBeGreaterThan(10);
    expect(rect.height).toBeGreaterThan(10);
  });

  it("draws the box top where the lead foot actually lands", () => {
    const pose = EXERCISE_POSES["step-up"];
    const prop = pose.prop as Extract<typeof pose.prop, { kind: "box" }>;
    const projector = makeProjector(pose.camera.position);
    const fit = fitTransform(pose, projector);
    const rect = boxRect(prop, projector, fit);
    const heel = pointAt(pose, 0.55, "heelL");
    const [, hy] = projector.project(heel);
    expect(Math.abs(hy * fit.scale + fit.offsetY - rect.y)).toBeLessThan(4);
  });

  it("keeps the whole figure inside the viewBox for every exercise and frame", () => {
    for (const id of ANIMATION_IDS) {
      const pose = EXERCISE_POSES[id];
      const projector = makeProjector(pose.camera.position);
      const fit = fitTransform(pose, projector);
      for (const t of samples(40)) {
        const f = sampleFrame(pose, t);
        for (const s of buildSegments(f.skeleton, f.root, projector, fit)) {
          const pad = (s.radius ?? s.width / 2) + 1;
          for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
            expect(x, `${id} clipped left at t=${t}`).toBeGreaterThan(-pad);
            expect(x, `${id} clipped right at t=${t}`).toBeLessThan(VIEW_W + pad);
            expect(y, `${id} clipped top at t=${t}`).toBeGreaterThan(-pad);
            expect(y, `${id} clipped bottom at t=${t}`).toBeLessThan(VIEW_H + pad);
          }
        }
      }
    }
  });

  it("frames each exercise on the plane its movement happens in", () => {
    // A lateral movement viewed from the side shows almost nothing, so the
    // band walk must be the one exercise projected head-on.
    const lateral = makeProjector(EXERCISE_POSES["lateral-band-walk"].camera.position);
    expect(Math.abs(lateral.project([1, 0, 0])[0])).toBeCloseTo(1, 5);
    const sagittal = makeProjector(EXERCISE_POSES.squat.camera.position);
    expect(Math.abs(sagittal.project([0, 0, 1])[0])).toBeCloseTo(1, 5);
  });

  it("orders segments far-to-near so near limbs draw on top", () => {
    const pose = EXERCISE_POSES.lunge;
    const projector = makeProjector(pose.camera.position);
    const fit = fitTransform(pose, projector);
    const f = sampleFrame(pose, 0.5);
    const segs = buildSegments(f.skeleton, f.root, projector, fit);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i - 1].depth).toBeGreaterThanOrEqual(segs[i].depth);
    }
  });
});

describe("3D mesh placement", () => {
  it("puts the drawn sole exactly on the heel and ball contact points", () => {
    // The foot capsule used to extend 40 mm past the ball, so plantarflexing
    // for a calf raise drove the toe through the floor even though the ball
    // contact was perfect.
    const foot = BONES.find((b) => b.name === "footL")!;
    const [, oy, oz] = foot.meshOffset ?? [0, 0, 0];
    expect(oy - foot.radius, "sole height vs heel/ball local y").toBeCloseTo(-0.07, 5);
    expect(oz, "capsule starts at the heel").toBeCloseTo(-0.05, 5);
    expect(oz + foot.length, "capsule ends at the ball").toBeCloseTo(0.11, 5);
  });
});
