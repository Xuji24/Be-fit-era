/**
 * POST /api/webhook/paymongo
 *
 * Receives PayMongo webhook events and confirms payments.
 *
 * Setup (PayMongo Dashboard → Developers → Webhooks):
 *   URL:    https://yourdomain.com/api/webhook/paymongo
 *   Events: checkout_session.payment.paid
 *
 * Environment variables required:
 *   PAYMONGO_SECRET_KEY    — sk_test_... (sandbox) or sk_live_... (production)
 *   PAYMONGO_WEBHOOK_SECRET — whsec_... from the PayMongo webhook dashboard
 *
 * Switching to live: just swap PAYMONGO_SECRET_KEY=sk_live_... and
 * PAYMONGO_WEBHOOK_SECRET to the live webhook secret. No code changes needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyWebhookSignature, getCheckoutSession } from "@/lib/paymongo";
import { createClient } from "@/lib/supabase/server";
import { isPaidTier } from "@/lib/coach/tiers";

// PayMongo sends raw JSON — we must read the raw body to verify the signature
export const runtime = "nodejs";

// The webhook has no user session and coach_subscriptions has no authenticated
// UPDATE policy (by design — see the create-tables migration), so granting a
// tier requires the service role, same as app/api/cron/update-races/route.ts.
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin credentials are not configured");
  }
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("paymongo-signature");

  // Always verify — reject anything that doesn't pass signature check
  const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    console.warn("[webhook/paymongo] Invalid signature — rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PayMongoEvent;
  try {
    event = JSON.parse(rawBody) as PayMongoEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.data?.attributes?.type;

  // We only care about successful checkout payments
  if (eventType !== "checkout_session.payment.paid") {
    return NextResponse.json({ received: true });
  }

  const checkoutSessionId: string | undefined =
    event.data?.attributes?.data?.id;

  if (!checkoutSessionId) {
    console.error("[webhook/paymongo] Missing checkout session id in event");
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }

  // Fetch the session from PayMongo to get authoritative metadata
  const session = await getCheckoutSession(checkoutSessionId);
  if (!session) {
    console.error(
      `[webhook/paymongo] Could not fetch session ${checkoutSessionId}`,
    );
    return NextResponse.json(
      { error: "Session not found" },
      { status: 400 },
    );
  }

  const paymentStatus: string = session.attributes?.payment_intent?.attributes?.status;
  const metadata: Record<string, string> | undefined = session.attributes?.metadata;

  // Only mark paid if PayMongo confirms the payment succeeded
  if (paymentStatus !== "succeeded") {
    console.warn(
      `[webhook/paymongo] Session ${checkoutSessionId} payment status: ${paymentStatus} — skipping`,
    );
    return NextResponse.json({ received: true });
  }

  if (metadata?.kind === "coach_subscription") {
    return handleCoachSubscriptionPaid(checkoutSessionId, metadata);
  }

  const raceId: string | undefined = metadata?.race_id;

  if (!raceId) {
    console.error("[webhook/paymongo] No race_id in session metadata");
    return NextResponse.json({ error: "Missing race_id" }, { status: 400 });
  }

  // Derive the user from the checkout session billing email
  const billingEmail: string | undefined =
    session.attributes?.billing?.email;

  if (!billingEmail) {
    console.error("[webhook/paymongo] No billing email in session");
    return NextResponse.json({ error: "Missing billing email" }, { status: 400 });
  }

  // Use service-role client — webhook runs outside a user session
  const supabase = await createClient();

  // Look up the user by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", billingEmail)
    .maybeSingle();

  if (!profile) {
    console.error(`[webhook/paymongo] No profile found for email ${billingEmail}`);
    return NextResponse.json({ error: "User not found" }, { status: 400 });
  }

  // Mark the registration as paid
  const { error: updateError } = await supabase
    .from("race_registrations")
    .update({
      payment_status: "paid",
      paymongo_session_id: checkoutSessionId,
    })
    .eq("user_id", profile.id)
    .eq("race_id", raceId)
    .neq("payment_status", "paid"); // idempotent — skip if already marked

  if (updateError) {
    console.error("[webhook/paymongo] Failed to update registration:", updateError);
    // Return 500 so PayMongo retries
    return NextResponse.json(
      { error: "Database update failed" },
      { status: 500 },
    );
  }

  console.log(
    `[webhook/paymongo] Payment confirmed — race ${raceId}, user ${profile.id}`,
  );

  return NextResponse.json({ received: true });
}

/**
 * Grants a coach subscription tier after PayMongo confirms payment.
 *
 * Matched by metadata.user_id, not billing email — a user's profile email can
 * differ from what they typed at checkout, and coach_subscriptions is already
 * keyed by user_id everywhere else.
 */
async function handleCoachSubscriptionPaid(
  checkoutSessionId: string,
  metadata: Record<string, string>,
): Promise<NextResponse> {
  const userId = metadata.user_id;
  const tier = metadata.tier;

  if (!userId || !isPaidTier(tier)) {
    console.error(
      `[webhook/paymongo] Invalid coach subscription metadata for session ${checkoutSessionId}: user_id=${userId} tier=${tier}`,
    );
    return NextResponse.json({ error: "Invalid subscription metadata" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const currentPeriodEnd = new Date();
  currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + 1);

  const { error: updateError } = await supabaseAdmin
    .from("coach_subscriptions")
    .update({
      status: "active",
      tier,
      current_period_end: currentPeriodEnd.toISOString(),
      paymongo_session_id: checkoutSessionId,
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("[webhook/paymongo] Failed to update coach subscription:", updateError);
    // Return 500 so PayMongo retries
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  console.log(
    `[webhook/paymongo] Coach subscription activated — tier ${tier}, user ${userId}`,
  );

  return NextResponse.json({ received: true });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PayMongoEvent {
  data?: {
    attributes?: {
      type?: string;
      data?: {
        id?: string;
      };
    };
  };
}
