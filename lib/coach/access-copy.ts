/**
 * User-facing copy for coach access states.
 *
 * Pure functions, kept out of the components so the wording can be tested.
 * These exist because the first version inferred "your trial has ended" from
 * a bare `hasAccess: false`, which told brand-new users — and users who had
 * simply spent a quota mid-trial — that their trial was over. The distinct
 * states are:
 *
 *   not_started   never onboarded, no subscription row yet
 *   trial_expired the 14 days elapsed
 *   cancelled     a paid subscription was cancelled
 *   (quota)       allowance spent, but the trial/period is still running
 */

export type DeniedReason = "trial_expired" | "cancelled" | "not_started" | null;

export interface AccessCopyInput {
  deniedReason: DeniedReason;
  tier: string;
  outOfPlans: boolean;
  outOfChat: boolean;
}

/** Headline shown on the subscribe page. */
export function subscribeSubtitle(a: AccessCopyInput): string {
  if (a.deniedReason === "trial_expired") return "Your 14-day free trial is over. Pick a plan to keep your coach.";
  if (a.deniedReason === "cancelled") return "Your subscription was cancelled. Pick a plan to start again.";
  if (a.deniedReason === "not_started") return "Start with the free trial — no card needed.";
  // "free" only applies to the trial tier — a paying Starter user hasn't used
  // a "free" allowance, they've used the one they bought.
  const owned = a.tier === "free" ? "free " : "";
  if (a.outOfPlans && a.outOfChat) return `You've used your ${owned}allowance. Pick a plan to keep going.`;
  if (a.outOfPlans) return `You've used your ${owned}plan generations. Pick a plan for more.`;
  if (a.outOfChat) return `You've used your ${owned}coach messages. Pick a plan for more.`;
  return "Upgrade any time. Your plans and progress stay exactly as they are.";
}

/**
 * Dashboard banner shown when an allowance is spent. Never claims the trial
 * ended — a free user who burns their chat quota on day 2 still has a live
 * trial and the rest of the coach to explore.
 */
export function quotaBannerText(a: AccessCopyInput): string {
  // A user who never started a trial has spent nothing — the zero-limit
  // EMPTY_QUOTA makes them look exhausted, which would otherwise produce
  // "you've used all your..." for someone who has used nothing at all.
  if (a.deniedReason === "not_started") return "Start your free trial to use the coach.";

  const what =
    a.outOfPlans && a.outOfChat
      ? "You've used all your plan generations and coach messages."
      : a.outOfPlans
        ? "You've used all your plan generations."
        : "You've used all your coach messages.";

  if (a.tier !== "free") return `${what} Upgrade for a bigger allowance.`;
  if (a.outOfPlans && a.outOfChat) return `${what} Subscribe to keep going.`;

  return `${what} You can still use your ${a.outOfPlans ? "coach messages" : "plan generations"} during the trial.`;
}

/** Trial countdown line. Returns null when the user isn't on a running trial. */
export function trialCountdown(status: string, daysLeft: number | null): string | null {
  if (status !== "trialing" || daysLeft === null) return null;
  if (daysLeft === 0) return "last day";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}
