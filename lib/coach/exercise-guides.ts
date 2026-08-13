/**
 * How-to steps for every exercise we animate.
 *
 * Written here rather than fetched, because the wger API only covers a
 * handful of our exercises and returns nothing for the rest. Owning this
 * text also means it matches the coach's voice ("explain like the person has
 * no fitness background") instead of wger's clinical phrasing.
 *
 * The set is deliberately narrow and running-focused — knee/leg/calf/
 * hamstring injury prevention and strength work, not a generic gym split.
 * See exercise-poses.ts's header comment for why.
 *
 * Keyed by ExerciseAnimationId, so anything we can animate is guaranteed to
 * have words to go with it — a guarantee the unit test enforces.
 *
 * `cues` are the two or three things people most often get wrong. They are
 * form guidance, not medical advice; anything about pain belongs in the
 * knowledge base article on aches, not here.
 */

import type { ExerciseAnimationId } from "@/components/pages/main/coach/component/exercise-rig";

export interface ExerciseGuide {
  steps: string[];
  cues: string[];
}

export const EXERCISE_GUIDES: Record<ExerciseAnimationId, ExerciseGuide> = {
  squat: {
    steps: [
      "Stand with your feet about shoulder-width apart, toes pointing slightly outward.",
      "Push your hips back as if you were sitting into a chair behind you.",
      "Bend your knees and lower until your thighs are roughly parallel to the floor.",
      "Drive through your whole foot to stand back up, squeezing your glutes at the top.",
    ],
    cues: [
      "Keep your knees tracking over your toes, not caving inward.",
      "Chest stays up — if it drops toward the floor, you have gone too low for now.",
      "Push your arms forward as you descend; it makes balancing much easier.",
    ],
  },
  lunge: {
    steps: [
      "Stand tall with your feet hip-width apart.",
      "Take a controlled step forward with one leg.",
      "Lower your back knee toward the floor until both knees are near right angles.",
      "Push through your front foot to return to standing, then swap legs.",
    ],
    cues: [
      "Keep your torso upright — leaning forward shifts the work off the legs.",
      "Your front knee should stay above your ankle, not drift past your toes.",
      "Take a bigger step than feels natural; short steps cramp the movement.",
    ],
  },
  "calf-raise": {
    steps: [
      "Stand tall with your feet hip-width apart, near a wall for balance.",
      "Push through the balls of your feet and lift your heels as high as you can.",
      "Pause briefly at the top.",
      "Lower your heels slowly back to the floor.",
    ],
    cues: [
      "The lowering half is where most of the work happens — take your time.",
      "Keep your ankles steady rather than rolling out to the little toes.",
      "Use the wall for balance only, not to push yourself up.",
    ],
  },
  "high-knees": {
    steps: [
      "Stand tall with your feet hip-width apart.",
      "Drive one knee up toward hip height.",
      "Swap quickly to the other leg, as if running on the spot.",
      "Pump your arms in time with your legs.",
    ],
    cues: [
      "Stay on the balls of your feet and keep contact with the ground brief.",
      "Chest stays tall — do not lean back to get the knees higher.",
      "Speed comes after control. Start slow enough to hit hip height.",
    ],
  },
  "glute-bridge": {
    steps: [
      "Lie on your back with your knees bent and feet flat, close to your hips.",
      "Rest your arms flat at your sides.",
      "Push through your heels and lift your hips until your body forms a ramp from knees to shoulders.",
      "Pause at the top, then lower with control.",
    ],
    cues: [
      "Squeeze your glutes at the top rather than arching your lower back.",
      "Keep your feet planted — if your heels lift, move them closer to your hips.",
      "Chin stays tucked; do not push your head into the floor.",
    ],
  },
  "step-up": {
    steps: [
      "Stand facing a sturdy step, bench, or box roughly knee height.",
      "Place your whole foot flat on the step.",
      "Push through that foot to stand up on the step, letting the other leg follow naturally.",
      "Step back down with control and repeat, or switch legs each rep.",
    ],
    cues: [
      "Push through your heel, not your toes — that keeps the work in your glute and quad.",
      "Stand all the way up on top of the step; don't let the back leg do the finishing work.",
      "Lower yourself under control on the way down instead of just dropping.",
    ],
  },
  "single-leg-rdl": {
    steps: [
      "Stand on one leg with a soft bend in that knee.",
      "Hinge forward at your hips, letting your other leg extend straight back behind you.",
      "Lower your torso until it's roughly parallel to the floor, keeping your back flat.",
      "Squeeze your glute on the standing leg to pull yourself back up to standing.",
    ],
    cues: [
      "Think about reaching your back heel toward the wall behind you, not lifting it up.",
      "Keep your hips square to the floor — don't let them rotate open.",
      "Hold onto a wall or chair with one hand at first; balance is the hard part, not strength.",
    ],
  },
  "lateral-band-walk": {
    steps: [
      "Loop a resistance band around your ankles or just above your knees.",
      "Bend your knees slightly into a quarter-squat and keep them bent the whole time.",
      "Step sideways with one foot, then bring the other foot in to meet it — never let your feet touch.",
      "Take the same number of steps in each direction.",
    ],
    cues: [
      "Keep tension on the band throughout — a foot fully closing the gap means you've relaxed it.",
      "Stay low in the quarter-squat; standing up tall takes the work out of your hips.",
      "Toes point forward the whole time, not out to the sides.",
    ],
  },
  "kettlebell-swing": {
    steps: [
      "Stand with your feet shoulder-width apart, kettlebell on the floor a short reach in front of you.",
      "Hinge at your hips to grip it with both hands, keeping your back flat, not rounded.",
      "Hike the kettlebell back between your legs like a football snap.",
      "Snap your hips forward explosively to drive the kettlebell up to chest height, then let it swing back down and repeat.",
    ],
    cues: [
      "This is a hip hinge, not a squat — the power comes from snapping your hips open, not bending your knees deeper.",
      "Keep your arms relaxed the whole time; they only guide the bell, they don't lift it.",
      "Let the kettlebell float to chest height and stop there — muscling it up to overhead turns this into a different lift.",
    ],
  },
};

/** Looks up our own guide for an animation id, or null when we have none. */
export function findExerciseGuide(animationId: ExerciseAnimationId | null): ExerciseGuide | null {
  return animationId ? EXERCISE_GUIDES[animationId] ?? null : null;
}
