"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  findExercisePose,
  sampleFrame,
  type ExercisePose,
} from "@/lib/coach/exercise-poses";
import { BONES, type Bone, type JointName } from "@/lib/coach/rig-skeleton";
import type { ExerciseAnimationId } from "./exercise-rig";

const DEG = Math.PI / 180;

/**
 * The jointed figure, built by walking the skeleton spec rather than by
 * hand-writing a hierarchy here. Limb sizes and joint offsets live in exactly
 * one place (lib/coach/rig-skeleton.ts), so the 2D view, the 3D view and the
 * kinematics solver cannot disagree about the body they are describing.
 *
 * Each bone is a THREE.Group positioned at its joint, with its mesh hanging
 * off that group — so setting `group.rotation` bends the body at the joint,
 * never around some other origin.
 */
function BoneMesh({ bone, color }: { bone: Bone; color: string }) {
  const [ox, oy, oz] = bone.meshOffset ?? [0, 0, 0];
  const material = (
    <meshStandardMaterial color={color} roughness={0.52} metalness={0.04} />
  );

  if (bone.shape === "box") {
    const [w, h, d] = bone.size ?? [0.2, 0.2, 0.2];
    return (
      <mesh position={[ox, oy, oz]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        {material}
      </mesh>
    );
  }

  const mid: [number, number, number] = [
    ox + (bone.dir[0] * bone.length) / 2,
    oy + (bone.dir[1] * bone.length) / 2,
    oz + (bone.dir[2] * bone.length) / 2,
  ];
  const tip: [number, number, number] = [
    ox + bone.dir[0] * bone.length,
    oy + bone.dir[1] * bone.length,
    oz + bone.dir[2] * bone.length,
  ];
  // Capsule geometry runs along Y; a +Z bone (the foot) needs a quarter turn.
  const rotation: [number, number, number] = bone.dir[2] !== 0 ? [Math.PI / 2, 0, 0] : [0, 0, 0];

  if (bone.shape === "sphere") {
    return (
      <>
        {/* The neck, then the skull at the end of it. */}
        <mesh position={mid} rotation={rotation} castShadow>
          <capsuleGeometry args={[0.045, Math.max(bone.length - 0.09, 0.02), 6, 16]} />
          {material}
        </mesh>
        <mesh position={tip} castShadow>
          <sphereGeometry args={[bone.radius, 24, 20]} />
          {material}
        </mesh>
      </>
    );
  }

  return (
    <mesh position={mid} rotation={rotation} castShadow receiveShadow>
      <capsuleGeometry args={[bone.radius, Math.max(bone.length - bone.radius * 2, 0.02), 6, 16]} />
      {material}
    </mesh>
  );
}

function BoneTree({
  parent,
  register,
  color,
}: {
  parent: JointName | null;
  register: (name: JointName) => (g: THREE.Group | null) => void;
  color: string;
}) {
  return (
    <>
      {BONES.filter((b) => b.parent === parent).map((bone) => (
        <group key={bone.name} ref={register(bone.name)} position={bone.offset}>
          <BoneMesh bone={bone} color={color} />
          <BoneTree parent={bone.name} register={register} color={color} />
        </group>
      ))}
    </>
  );
}

/**
 * Drives the figure each frame from the shared sampler.
 *
 * Note what is NOT here: any vertical offset. The root's position comes
 * straight out of the contact solver, which is why the planted foot stays
 * planted instead of sinking through the floor between keyframes.
 */
function Mannequin({
  pose,
  progressRef,
  color,
  bandRef,
  kettlebellRef,
}: {
  pose: ExercisePose;
  progressRef: React.MutableRefObject<number>;
  color: string;
  bandRef: React.MutableRefObject<THREE.Mesh | null>;
  kettlebellRef: React.MutableRefObject<THREE.Mesh | null>;
}) {
  const joints = useRef<Partial<Record<JointName, THREE.Group>>>({});
  const rootRef = useRef<THREE.Group>(null);

  const register = (name: JointName) => (g: THREE.Group | null) => {
    if (g) joints.current[name] = g;
  };

  useFrame(() => {
    const frame = sampleFrame(pose, progressRef.current);

    // Every joint is written every frame. The previous version skipped joints
    // whose value happened to be zero, which left them holding a stale
    // rotation from an earlier frame.
    for (const bone of BONES) {
      const group = joints.current[bone.name];
      if (!group) continue;
      const rot = frame.rotations[bone.name];
      group.rotation.set((rot.x ?? 0) * DEG, 0, (rot.z ?? 0) * DEG);
    }

    const root = rootRef.current;
    if (root) {
      root.rotation.x = pose.bodyPitch * DEG;
      root.position.set(frame.root[0], frame.root[1], frame.root[2]);
    }

    // The band spans ankle to ankle, so it tracks the feet rather than being
    // decoration parked near them.
    const band = bandRef.current;
    if (band) {
      const a = new THREE.Vector3(...frame.skeleton.footL.p).add(new THREE.Vector3(...frame.root));
      const b = new THREE.Vector3(...frame.skeleton.footR.p).add(new THREE.Vector3(...frame.root));
      band.position.copy(a).add(b).multiplyScalar(0.5);
      const span = new THREE.Vector3().subVectors(b, a);
      band.scale.set(1, Math.max(span.length(), 0.01), 1);
      band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), span.clone().normalize());
    }

    // Held between both hands: the midpoint of the two wrists (the
    // forearm's TIP, not its joint), never an authored position — the same
    // "derive, don't author" rule the root itself follows.
    const kettlebell = kettlebellRef.current;
    if (kettlebell) {
      const l = new THREE.Vector3(...frame.skeleton.forearmL.tip).add(new THREE.Vector3(...frame.root));
      const r = new THREE.Vector3(...frame.skeleton.forearmR.tip).add(new THREE.Vector3(...frame.root));
      kettlebell.position.copy(l).add(r).multiplyScalar(0.5);
    }
  });

  return (
    <group ref={rootRef}>
      <BoneTree parent={null} register={register} color={color} />
    </group>
  );
}

/** Advances the loop clock, unless reduced motion asks for a still. */
function Clock({
  progressRef,
  durationSec,
  reducedMotion,
  stillAt,
}: {
  progressRef: React.MutableRefObject<number>;
  durationSec: number;
  reducedMotion: boolean;
  stillAt: number;
}) {
  useFrame((state) => {
    progressRef.current = reducedMotion
      ? stillAt
      : (state.clock.elapsedTime % durationSec) / durationSec;
  });
  return null;
}

interface ExerciseModel3DProps {
  animationId: ExerciseAnimationId;
  className?: string;
  color?: string;
}

/**
 * The 3D demonstration. Orbitable, because a fixed view can't show which limb
 * is in front — but no longer self-rotating: the camera used to spin
 * continuously while a 1-3 second rep looped underneath it, so the viewing
 * angle changed mid-movement and a sagittal exercise could be read from
 * behind. Each exercise now opens framed on the plane its movement actually
 * happens in, and the user turns it themselves if they want another angle.
 *
 * This component and its `three`/`@react-three/fiber` imports must only ever
 * be reached through a `next/dynamic(..., { ssr: false })` boundary — see
 * exercise-demo-modal.tsx — so the ~200KB 3D bundle never loads for a user
 * who doesn't open a demo.
 */
export default function ExerciseModel3D({
  animationId,
  className = "",
  // Three.js material colors need a literal value, not a CSS var() — keep
  // this in sync with --brand in app/globals.css by hand.
  color = "#FFB366",
}: ExerciseModel3DProps) {
  const pose = findExercisePose(animationId);
  const progressRef = useRef(0);
  const bandRef = useRef<THREE.Mesh | null>(null);
  const kettlebellRef = useRef<THREE.Mesh | null>(null);

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  if (!pose) return null;

  // A still frame should show the exercise's working end, not an arbitrary
  // midpoint — the second keyframe is the loaded position in every sequence.
  const stillAt = pose.keyframes[1]?.t ?? 0.5;

  return (
    <div className={className}>
      <Canvas
        shadows
        camera={{ position: pose.camera.position, fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <hemisphereLight args={["#ffffff", "#b8b0a4", 0.55]} />
        <directionalLight
          position={[2.4, 3.4, 2.2]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-1.6}
          shadow-camera-right={1.6}
          shadow-camera-top={2.2}
          shadow-camera-bottom={-0.4}
          shadow-bias={-0.0008}
        />
        {/* Fill from the camera side so the near limbs don't read as silhouette. */}
        <directionalLight position={[-2, 1.2, 2.5]} intensity={0.32} />

        {/* The floor. Without it there is no reference for whether the figure
            is rising or sinking, and the shadows every mesh was already
            casting had nothing to land on. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <circleGeometry args={[2.6, 64]} />
          <meshStandardMaterial color="#e8e3d9" roughness={0.95} />
        </mesh>

        {pose.prop?.kind === "box" && (
          <mesh position={pose.prop.center} castShadow receiveShadow>
            <boxGeometry args={[pose.prop.width, pose.prop.height, pose.prop.depth]} />
            <meshStandardMaterial color="#9a9287" roughness={0.85} />
          </mesh>
        )}

        {pose.prop?.kind === "band" && (
          <mesh ref={bandRef}>
            {/* Unit height, scaled to the ankle gap each frame. */}
            <cylinderGeometry args={[0.022, 0.022, 1, 12]} />
            <meshStandardMaterial color="#2E6F6B" roughness={0.6} />
          </mesh>
        )}

        {pose.prop?.kind === "kettlebell" && (
          <mesh ref={kettlebellRef} castShadow>
            <sphereGeometry args={[0.075, 20, 16]} />
            <meshStandardMaterial color="#2B2B2E" roughness={0.4} metalness={0.15} />
          </mesh>
        )}

        <Clock
          progressRef={progressRef}
          durationSec={pose.durationSec}
          reducedMotion={reducedMotion}
          stillAt={stillAt}
        />
        <Mannequin pose={pose} progressRef={progressRef} color={color} bandRef={bandRef} kettlebellRef={kettlebellRef} />

        <OrbitControls
          target={pose.camera.target}
          enablePan={false}
          minDistance={1.1}
          maxDistance={4.2}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />
      </Canvas>
    </div>
  );
}
