/**
 * Quota enforcement for metered AI features.
 *
 * Every call that spends money on an LLM must go through consumeQuota()
 * BEFORE the provider call, and must abort if it isn't granted. Checking
 * remaining quota for display (peekQuota) is separate and deliberately
 * non-committing — a read must never spend an allowance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { limitFor, periodFor, periodKey, type CoachTier, type QuotaKind } from "./tiers";

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

/**
 * Atomically claims one unit. Returns granted=false when the allowance is
 * spent — the caller must return an error and skip the provider call.
 *
 * The atomicity lives in the consume_coach_quota() SQL function, not here:
 * two concurrent requests on the last unit must not both succeed, which a
 * read-then-write in TypeScript cannot guarantee.
 */
export async function consumeQuota(
  supabase: SupabaseClient,
  tier: CoachTier,
  kind: QuotaKind
): Promise<{ granted: boolean; state: QuotaState }> {
  const limit = limitFor(tier, kind);
  const key = periodKey(periodFor(tier, kind));

  const { data, error } = await supabase.rpc("consume_coach_quota", {
    p_kind: kind,
    p_period_key: key,
    p_limit: limit,
  });

  // Fail closed: if the meter is unreadable we do not hand out a free call.
  if (error) {
    return { granted: false, state: { used: limit, limit, remaining: 0, exhausted: true } };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const granted = row?.granted === true;
  const used = typeof row?.used === "number" ? row.used : limit;

  return {
    granted,
    state: { used, limit, remaining: Math.max(0, limit - used), exhausted: !granted },
  };
}

/** Reads current usage without spending any. Safe to call on every render. */
export async function peekQuota(
  supabase: SupabaseClient,
  userId: string,
  tier: CoachTier,
  kind: QuotaKind
): Promise<QuotaState> {
  const limit = limitFor(tier, kind);
  const key = periodKey(periodFor(tier, kind));

  const { data } = await supabase
    .from("coach_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("period_key", key)
    .maybeSingle();

  const used = data?.count ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used), exhausted: used >= limit };
}

/**
 * Refunds one unit after a provider call failed. Without this, an outage on
 * the AI side would silently burn the user's allowance for a plan they never
 * received. Best-effort: a failed refund must not mask the original error.
 */
export async function refundQuota(
  supabase: SupabaseClient,
  userId: string,
  tier: CoachTier,
  kind: QuotaKind
): Promise<void> {
  const key = periodKey(periodFor(tier, kind));
  const { data } = await supabase
    .from("coach_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("period_key", key)
    .maybeSingle();

  if (!data || data.count <= 0) return;

  await supabase
    .from("coach_usage")
    .update({ count: data.count - 1 })
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("period_key", key);
}

/** User-facing copy when an allowance runs out. Differs by tier and feature. */
export function exhaustedMessage(tier: CoachTier, kind: QuotaKind): string {
  const thing = kind === "plan" ? "plan generations" : "coach messages";
  if (tier === "free") {
    return `You've used all your free ${thing}. Subscribe to keep going.`;
  }
  const window = periodFor(tier, kind) === "day" ? "today" : "this month";
  return `You've used all your ${thing} ${window}. ${
    tier === "starter" ? "Upgrade to Pro for more." : "Your allowance resets soon."
  }`;
}
