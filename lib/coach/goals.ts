/**
 * Weight-goal detection for the one-time "goal reached" celebration
 * (app/api/cron/coach-proactive/route.ts).
 *
 * Direction-agnostic on purpose: coach_profiles.goal doesn't cleanly map to
 * "weight should go down" (build_muscle can mean a deliberate weight-gain
 * target too), so direction is inferred from where target sits relative to
 * the weight captured at intake, not from the goal enum.
 */

/**
 * `initialWeightKg` is coach_profiles.weight_kg (captured at intake, static
 * thereafter). `latestWeightKg` is the most recent coach_weight_logs entry.
 * Only weight-based targets are handled — target_body_shape is
 * self-reported/subjective and isn't auto-detectable from a number.
 */
export function checkGoalProgress(
  initialWeightKg: number,
  targetWeightKg: number,
  latestWeightKg: number
): boolean {
  const delta = targetWeightKg - initialWeightKg;

  if (delta === 0) {
    // Degenerate input (target set equal to the starting weight) — treat as
    // reached only on an exact match, not on every subsequent check-in.
    return Math.abs(latestWeightKg - targetWeightKg) < 0.01;
  }

  return delta < 0 ? latestWeightKg <= targetWeightKg : latestWeightKg >= targetWeightKg;
}
