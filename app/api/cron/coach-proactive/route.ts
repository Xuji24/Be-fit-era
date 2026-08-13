import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { sendEmail } from "@/lib/email";
import { getEngagementDates, daysSinceLastLog } from "@/lib/coach/streaks";
import { checkGoalProgress } from "@/lib/coach/goals";
import { computeWeekSummary, formatDigestMessage, isoWeekKey } from "@/lib/coach/digest";

// A quiet user isn't nudged until this many days have passed since their
// last food or workout log.
const STREAK_BREAK_THRESHOLD_DAYS = 3;

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin credentials are not configured");
  }
  return createSupabaseClient(url, key);
}

// Configured lazily (not at module scope) so a build/static-analysis pass
// with no VAPID env vars set doesn't crash evaluating this route — web-push
// throws synchronously from setVapidDetails on an empty key.
let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_EMAIL ?? "mailto:admin@befitiera.com", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function sendPushToUser(supabase: SupabaseClient, userId: string, title: string, body: string, url: string) {
  if (!ensureVapidConfigured()) return;

  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, auth, p256dh").eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, payload)
    )
  );
}

async function sendEmailToUser(supabase: SupabaseClient, userId: string, subject: string, message: string) {
  const { data } = await supabase.auth.admin.getUserById(userId);
  const email = data?.user?.email;
  if (!email) return;
  await sendEmail({ to: email, subject, message });
}

/**
 * Attempts the dedup-log insert for one notification kind/period. Returns
 * true only if this call actually inserted the row (i.e. it's safe to send)
 * — a unique-constraint failure means it was already sent, so this returns
 * false without treating it as an error.
 */
async function claimSend(supabase: SupabaseClient, userId: string, kind: string, periodKey: string): Promise<boolean> {
  const { error } = await supabase.from("coach_notification_log").insert({ user_id: userId, kind, period_key: periodKey });
  return !error;
}

/**
 * Daily proactive-coaching sweep: streak-break nudges every day, the weekly
 * digest on Mondays (UTC), and a one-time goal-reached celebration. Sends
 * are inline (webpush + sendEmail directly) rather than an HTTP hop through
 * /api/push/send — see docs/COACH_SUBSCRIPTION_NOTES.md's TD-02 for why
 * internal server-to-server sends in this app avoid the extra hop.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = new Date();
  const isMonday = today.getUTCDay() === 1;

  let digestsSent = 0;
  let nudgesSent = 0;
  let celebrationsSent = 0;
  let errors = 0;

  try {
    const supabase = getSupabaseAdmin();

    const { data: subs, error: subsError } = await supabase
      .from("coach_subscriptions")
      .select("user_id")
      .in("status", ["trialing", "active"]);
    if (subsError) throw subsError;

    const userIds = (subs ?? []).map((s) => s.user_id as string);
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, digestsSent, nudgesSent, celebrationsSent, errors });
    }

    const [{ data: prefRows }, { data: profileRows }, { data: weightRows }] = await Promise.all([
      supabase
        .from("notification_preferences")
        .select("user_id, coach_weekly_digest, coach_streak_nudge, coach_email_enabled")
        .in("user_id", userIds),
      supabase.from("coach_profiles").select("user_id, weight_kg, target_weight_kg").in("user_id", userIds),
      supabase
        .from("coach_weight_logs")
        .select("user_id, logged_on, weight_kg")
        .in("user_id", userIds)
        .order("logged_on", { ascending: false }),
    ]);

    const prefsByUser = new Map((prefRows ?? []).map((p) => [p.user_id as string, p]));
    const profileByUser = new Map((profileRows ?? []).map((p) => [p.user_id as string, p]));
    const latestWeightByUser = new Map<string, { weight_kg: number }>();
    (weightRows ?? []).forEach((row) => {
      // Rows arrive newest-first; only the first one seen per user is kept.
      if (!latestWeightByUser.has(row.user_id)) latestWeightByUser.set(row.user_id, row);
    });

    for (const userId of userIds) {
      try {
        const prefs = prefsByUser.get(userId);
        const digestEnabled = prefs?.coach_weekly_digest ?? true;
        const nudgeEnabled = prefs?.coach_streak_nudge ?? true;
        const emailEnabled = prefs?.coach_email_enabled ?? true;

        if (nudgeEnabled) {
          const dates = await getEngagementDates(supabase, userId);
          const idle = daysSinceLastLog(dates, today);
          if (idle !== null && idle >= STREAK_BREAK_THRESHOLD_DAYS) {
            const lastLoggedDate = dates.reduce((max, d) => (d > max ? d : max));
            const canSend = await claimSend(supabase, userId, "streak_nudge", `streak-break:${lastLoggedDate}`);
            if (canSend) {
              const title = "Still there?";
              const body = `It's been ${idle} days since your last log. Your plan is waiting whenever you're ready.`;
              await sendPushToUser(supabase, userId, title, body, "/coach/tracker");
              if (emailEnabled) await sendEmailToUser(supabase, userId, title, body);
              nudgesSent += 1;
            }
          }
        }

        if (isMonday && digestEnabled) {
          const weekStart = new Date(today.getTime() - 6 * 86_400_000);
          const canSend = await claimSend(supabase, userId, "weekly_digest", isoWeekKey(today));
          if (canSend) {
            const summary = await computeWeekSummary(supabase, userId, weekStart);
            const { title, body } = formatDigestMessage(summary);
            await sendPushToUser(supabase, userId, title, body, "/coach/progress");
            if (emailEnabled) await sendEmailToUser(supabase, userId, title, body);
            digestsSent += 1;
          }
        }

        const profile = profileByUser.get(userId);
        const latestWeight = latestWeightByUser.get(userId);
        if (profile?.target_weight_kg != null && latestWeight) {
          const reached = checkGoalProgress(profile.weight_kg, profile.target_weight_kg, latestWeight.weight_kg);
          if (reached) {
            const canSend = await claimSend(supabase, userId, "goal_reached", "reached");
            if (canSend) {
              const title = "Goal reached!";
              const body = `You hit your target weight of ${profile.target_weight_kg}kg. Time to set a new goal or keep maintaining — your call.`;
              await sendPushToUser(supabase, userId, title, body, "/coach/progress");
              if (emailEnabled) await sendEmailToUser(supabase, userId, title, body);
              celebrationsSent += 1;
            }
          }
        }
      } catch (userError) {
        console.error(`coach-proactive failed for user ${userId}:`, userError);
        errors += 1;
      }
    }

    return NextResponse.json({ success: true, digestsSent, nudgesSent, celebrationsSent, errors });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
