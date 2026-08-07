"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createSubscriptionCheckoutSession } from "@/lib/paymongo";
import { TIERS, isPaidTier } from "@/lib/coach/tiers";

export interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

/**
 * Starts the 14-day free trial for a user who doesn't have a subscription row.
 *
 * saveIntake() also does this on first onboarding, but it was the only path,
 * which left anyone whose row was missing stranded: the dashboard redirects to
 * /coach/subscribe when hasAccess is false, and the free card there is not
 * purchasable — a dead end with no way back into the coach.
 *
 * Safe to expose: the RLS policy `users_start_own_coach_trial` pins the insert
 * to status='trialing', tier='free', and no payment fields, and the UNIQUE
 * constraint on user_id means this can never extend or restart a trial that
 * already exists.
 */
export async function startFreeTrial(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const { data: existing } = await supabase
    .from("coach_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Already had a trial — used up or not, it does not come back.
  if (existing) {
    return { success: false, error: "You've already used your free trial. Pick a plan to continue." };
  }

  const { error } = await supabase.from("coach_subscriptions").insert({ user_id: user.id });
  if (error) return { success: false, error: "Could not start your free trial. Please try again." };

  revalidatePath("/coach");
  revalidatePath("/coach/subscribe");
  return { success: true };
}

/**
 * Starts a PayMongo checkout for a coach subscription.
 *
 * The price is read from TIERS server-side and never accepted from the
 * client — a tier id is the only thing the caller gets to choose, so a
 * tampered request can't buy Pro for ₱1.
 *
 * This only creates the session. The subscription is activated by the
 * PayMongo webhook after payment actually clears; nothing here grants access.
 */
export async function startSubscriptionCheckout(tier: string): Promise<CheckoutResult> {
  if (!isPaidTier(tier)) {
    return { success: false, error: "Choose a valid plan." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const definition = TIERS[tier];

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Same fallback as app/api/checkout/route.ts, for local development.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const session = await createSubscriptionCheckoutSession({
      userId: user.id,
      tier: definition.id,
      tierName: definition.name,
      amountPhp: definition.pricePhp,
      buyerEmail: user.email ?? "",
      buyerName: profile?.full_name ?? user.email ?? "Fitra user",
      appUrl,
    });

    // Recorded so the webhook can match the payment back to this user even if
    // the metadata round-trip ever fails.
    await supabase
      .from("coach_subscriptions")
      .update({ paymongo_session_id: session.id })
      .eq("user_id", user.id);

    return { success: true, checkoutUrl: session.checkoutUrl };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not start checkout. Please try again.",
    };
  }
}
