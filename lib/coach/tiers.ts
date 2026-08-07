/**
 * Subscription tiers for the AI coach.
 *
 * This file is the single source of truth for limits, pricing, and model
 * routing. Both the pricing cards and the server-side quota checks read from
 * here — if a limit is changed, it changes in one place and the UI can never
 * advertise something the gate won't honour.
 *
 * Model routing note: only plan generation is upgraded on Pro. Plan
 * generations are capped and their quality is visible to the user, so the
 * frontier model earns its cost there. Chat volume is unpredictable, so it
 * stays on the fast model at every tier — a frontier chat quota generous
 * enough to feel good would cost more per user than the subscription.
 */

export type CoachTier = "free" | "starter" | "pro";

/** What a quota is spent on. Metered separately — a plan costs ~20x a chat turn. */
export type QuotaKind = "plan" | "chat";

/** How a tier's quota refills. Free never refills; it is a one-time allowance. */
export type QuotaPeriod = "trial" | "day" | "month";

export interface TierLimits {
  /** Plan generations allowed per planPeriod. */
  plans: number;
  planPeriod: QuotaPeriod;
  /** Chat messages allowed per chatPeriod. */
  chat: number;
  chatPeriod: QuotaPeriod;
}

export interface TierDefinition {
  id: CoachTier;
  name: string;
  /** Monthly price in PHP. Free is 0 and has no checkout. */
  pricePhp: number;
  tagline: string;
  limits: TierLimits;
  /** Weeks of plan the generator is asked to produce. */
  planWeeks: number;
  /** How many past plans stay readable. null = unlimited. */
  historyLimit: number | null;
  /**
   * Model override for plan generation only. null = use the configured
   * default (fast) model. Chat always uses the default.
   */
  planModel: string | null;
  /** Bullet copy for the pricing card. */
  features: string[];
}

/**
 * The frontier model used for Pro plan generation. Overridable so the model
 * can be swapped without a deploy, but it must stay a model the active
 * provider actually serves — see lib/ai/provider.ts.
 */
export const PRO_PLAN_MODEL = process.env.AI_MODEL_PRO?.trim() || "gemini-2.5-pro";

export const TIERS: Record<CoachTier, TierDefinition> = {
  free: {
    id: "free",
    name: "Free Trial",
    pricePhp: 0,
    tagline: "Try the coach, no card needed.",
    limits: { plans: 3, planPeriod: "trial", chat: 20, chatPeriod: "trial" },
    planWeeks: 1,
    historyLimit: 1,
    planModel: null,
    features: [
      "3 plan generations",
      "20 coach chat messages",
      "1-week personalized plan",
      "Budget-aware Filipino meals",
      "Weight & progress tracking",
      "Expires after 14 days",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    pricePhp: 199,
    tagline: "A full coach that keeps up with you.",
    limits: { plans: 4, planPeriod: "month", chat: 30, chatPeriod: "day" },
    planWeeks: 1,
    historyLimit: 3,
    planModel: null,
    features: [
      "4 plan generations a month",
      "30 coach chat messages a day",
      "1-week personalized plan",
      "Budget-aware Filipino meals",
      "Weight & progress tracking",
      "Your last 3 plans kept",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    pricePhp: 399,
    tagline: "Our most capable model builds your plan.",
    limits: { plans: 6, planPeriod: "month", chat: 150, chatPeriod: "day" },
    planWeeks: 4,
    historyLimit: null,
    planModel: PRO_PLAN_MODEL,
    features: [
      "Plans built by our most capable model",
      "6 plan generations a month",
      "150 coach chat messages a day",
      "4-week periodized plan",
      "Budget-aware Filipino meals",
      "Unlimited plan history",
    ],
  },
};

/** Tiers in display order, cheapest first. */
export const TIER_ORDER: CoachTier[] = ["free", "starter", "pro"];

/** Paid tiers only — what checkout can actually be started for. */
export const PAID_TIERS: CoachTier[] = ["starter", "pro"];

export function isPaidTier(tier: string): tier is "starter" | "pro" {
  return tier === "starter" || tier === "pro";
}

/** Falls back to free for any unrecognised value rather than throwing. */
export function tierOf(tier: string | null | undefined): TierDefinition {
  return TIERS[(tier ?? "free") as CoachTier] ?? TIERS.free;
}

export function limitFor(tier: CoachTier, kind: QuotaKind): number {
  const { limits } = TIERS[tier];
  return kind === "plan" ? limits.plans : limits.chat;
}

export function periodFor(tier: CoachTier, kind: QuotaKind): QuotaPeriod {
  const { limits } = TIERS[tier];
  return kind === "plan" ? limits.planPeriod : limits.chatPeriod;
}

/**
 * The period bucket a usage row is counted against.
 * - trial:  one lifetime bucket, never resets
 * - day:    resets at UTC midnight
 * - month:  resets on the 1st, UTC
 *
 * UTC is deliberate: PH is UTC+8, so a local-midnight reset would need the
 * user's timezone, which the server doesn't reliably have. A quota that
 * resets at 8am Manila is predictable; one that resets per-device is not.
 */
export function periodKey(period: QuotaPeriod, now: Date = new Date()): string {
  if (period === "trial") return "trial";
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  if (period === "month") return `${y}-${m}`;
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
