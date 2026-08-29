import type { SupabaseClient } from "@supabase/supabase-js";

export interface FulfillResult {
  error: string | null;
  /** false when the row was already in its target state (idempotent no-op). */
  updated: boolean;
}

interface FulfillRaceRegistrationParams {
  userId: string;
  raceId: string;
  checkoutSessionId: string;
}

/**
 * Marks a race registration paid. Shared by the PayMongo webhook and the
 * expire-stale-payments cron (which calls this to self-heal a registration
 * whose webhook delivery was missed or timed out).
 *
 * Must run on a service-role client — race_registrations' RLS UPDATE
 * policies require an authenticated session matching user_id, which neither
 * caller has (a webhook request and a cron sweep both run outside any user
 * session).
 */
export async function fulfillRaceRegistrationPayment(
  supabaseAdmin: SupabaseClient,
  { userId, raceId, checkoutSessionId }: FulfillRaceRegistrationParams,
): Promise<FulfillResult> {
  const { data, error } = await supabaseAdmin
    .from("race_registrations")
    .update({
      payment_status: "paid",
      paymongo_session_id: checkoutSessionId,
    })
    .eq("user_id", userId)
    .eq("race_id", raceId)
    .neq("payment_status", "paid") // idempotent — skip if already marked
    .select("id");

  return { error: error ? error.message : null, updated: !!data && data.length > 0 };
}

interface FulfillCoachSubscriptionParams {
  userId: string;
  tier: "starter" | "pro";
  checkoutSessionId: string;
}

/**
 * Activates a coach subscription tier. Shared by the PayMongo webhook and
 * the expire-stale-payments cron's self-heal path.
 *
 * Idempotent against PayMongo redelivering the same event (or the cron
 * re-checking a session it already fulfilled): only applies if this checkout
 * session hasn't already been recorded, so a retry doesn't re-extend
 * current_period_end by another month. `.or()` treats a NULL
 * paymongo_session_id (brand-new subscription) as eligible too, since
 * `<> checkoutSessionId` alone would exclude NULL rows in SQL.
 */
export async function fulfillCoachSubscriptionPayment(
  supabaseAdmin: SupabaseClient,
  { userId, tier, checkoutSessionId }: FulfillCoachSubscriptionParams,
): Promise<FulfillResult> {
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + 1);

  const { data, error } = await supabaseAdmin
    .from("coach_subscriptions")
    .update({
      status: "active",
      tier,
      current_period_end: currentPeriodEnd.toISOString(),
      paymongo_session_id: checkoutSessionId,
    })
    .eq("user_id", userId)
    .or(`paymongo_session_id.is.null,paymongo_session_id.neq.${checkoutSessionId}`)
    .select("user_id");

  return { error: error ? error.message : null, updated: !!data && data.length > 0 };
}
