/**
 * GET /api/cron/expire-stale-payments
 *
 * PayMongo has no "checkout_session.payment.failed" event, so an abandoned,
 * failed, or timed-out checkout is otherwise invisible to this app. This
 * cron reconciles stale 'pending' payments directly against PayMongo's live
 * checkout session status. Runs once daily (see vercel.json — Vercel Hobby
 * plan caps cron frequency at once per day), so a stale payment may sit
 * unreconciled for up to ~24h before cleanup.
 *
 * Race registrations: a stale pending row still counts against a race's
 * capacity (register_for_race() only excludes status='cancelled', not
 * payment_status), so this cancels it to free the slot. Coach subscriptions
 * hold no capacity and no lockout risk, so they're only ever self-healed
 * (never cancelled) if PayMongo shows the payment actually succeeded.
 */

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCheckoutSession } from "@/lib/paymongo";
import { isPaidTier } from "@/lib/coach/tiers";
import {
  fulfillRaceRegistrationPayment,
  fulfillCoachSubscriptionPayment,
} from "@/lib/payments/fulfillment";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin credentials are not configured");
  }
  return createClient(url, key);
}

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

interface SweepSummary {
  checked: number;
  selfHealed: number;
  expired: number;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();

    const raceRegistrations = await sweepRaceRegistrations(supabaseAdmin, staleBefore);
    const coachSubscriptions = await sweepCoachSubscriptions(supabaseAdmin, staleBefore);

    return NextResponse.json({
      success: true,
      raceRegistrations,
      coachSubscriptions,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}

async function sweepRaceRegistrations(
  supabaseAdmin: SupabaseClient,
  staleBefore: string,
): Promise<SweepSummary> {
  const summary: SweepSummary = { checked: 0, selfHealed: 0, expired: 0 };

  const { data: staleRegistrations, error } = await supabaseAdmin
    .from("race_registrations")
    .select("id, user_id, race_id, paymongo_session_id")
    .eq("status", "upcoming")
    .eq("payment_status", "pending")
    .lt("registered_at", staleBefore);

  if (error || !staleRegistrations) {
    console.error("[cron/expire-stale-payments] Failed to fetch stale registrations:", error);
    return summary;
  }

  for (const reg of staleRegistrations) {
    summary.checked++;

    if (!reg.paymongo_session_id) {
      // Checkout was never even reached (e.g. the /api/checkout call failed
      // right after registration) — nothing to check against PayMongo.
      await cancelRaceRegistration(
        supabaseAdmin,
        reg.id,
        "Payment was not started or the session could not be created",
      );
      summary.expired++;
      continue;
    }

    const session = await getCheckoutSession(reg.paymongo_session_id);
    const paymentIntentStatus: string | undefined =
      session?.attributes?.payment_intent?.attributes?.status;
    const sessionStatus: string | undefined = session?.attributes?.status;

    if (paymentIntentStatus === "succeeded") {
      // The payment actually cleared but the webhook was missed or timed out.
      const { error: fulfillError, updated } = await fulfillRaceRegistrationPayment(
        supabaseAdmin,
        {
          userId: reg.user_id,
          raceId: reg.race_id,
          checkoutSessionId: reg.paymongo_session_id,
        },
      );
      if (fulfillError) {
        console.error(
          "[cron/expire-stale-payments] Failed to self-heal registration:",
          fulfillError,
        );
      } else if (updated) {
        summary.selfHealed++;
      }
      continue;
    }

    if (!session || sessionStatus === "expired") {
      await cancelRaceRegistration(
        supabaseAdmin,
        reg.id,
        "Payment session expired before completion",
      );
      summary.expired++;
    }
    // Otherwise still processing/awaiting payment and the session is still
    // active — leave it pending and re-check on the next run.
  }

  return summary;
}

async function cancelRaceRegistration(
  supabaseAdmin: SupabaseClient,
  registrationId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("race_registrations")
    .update({
      status: "cancelled",
      payment_status: "failed",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq("id", registrationId)
    .eq("payment_status", "pending"); // guard against a concurrent webhook/self-heal

  if (error) {
    console.error(
      `[cron/expire-stale-payments] Failed to cancel registration ${registrationId}:`,
      error,
    );
  }
}

async function sweepCoachSubscriptions(
  supabaseAdmin: SupabaseClient,
  staleBefore: string,
): Promise<SweepSummary> {
  const summary: SweepSummary = { checked: 0, selfHealed: 0, expired: 0 };

  const { data: staleSubscriptions, error } = await supabaseAdmin
    .from("coach_subscriptions")
    .select("user_id, paymongo_session_id, status")
    .not("paymongo_session_id", "is", null)
    .neq("status", "active")
    .lt("updated_at", staleBefore);

  if (error || !staleSubscriptions) {
    console.error(
      "[cron/expire-stale-payments] Failed to fetch stale coach subscriptions:",
      error,
    );
    return summary;
  }

  for (const sub of staleSubscriptions) {
    summary.checked++;

    const session = await getCheckoutSession(sub.paymongo_session_id as string);
    const paymentIntentStatus: string | undefined =
      session?.attributes?.payment_intent?.attributes?.status;
    const tier: string | undefined = session?.attributes?.metadata?.tier;

    if (paymentIntentStatus === "succeeded" && tier && isPaidTier(tier)) {
      const { error: fulfillError, updated } = await fulfillCoachSubscriptionPayment(
        supabaseAdmin,
        { userId: sub.user_id, tier, checkoutSessionId: sub.paymongo_session_id as string },
      );
      if (fulfillError) {
        console.error(
          "[cron/expire-stale-payments] Failed to self-heal coach subscription:",
          fulfillError,
        );
      } else if (updated) {
        summary.selfHealed++;
      }
    }
    // No cancellation path — a coach subscription holds no capacity and a
    // never-completed payment carries no lockout risk, so it's just left
    // as-is if PayMongo hasn't confirmed it.
  }

  return summary;
}
