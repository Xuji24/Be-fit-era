import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { chat, type ChatMessage } from "@/lib/ai/provider";
import { getCoachAccess } from "@/app/actions/coach-actions";
import { consumeQuota, refundQuota, exhaustedMessage } from "@/lib/coach/quota";

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_WINDOW = 12; // recent turns kept as context, oldest dropped first

/**
 * The core ask: terse, plain-language answers. Long-winded coaching prose
 * defeats the point of a quick-question chat — this is enforced here, not
 * left to the model's default verbosity.
 */
const SYSTEM_PROMPT = `You are Fitra's AI coach chat. Answer in as few words as possible — 1-3 short sentences unless the user explicitly asks for detail. No filler ("Great question!", "I'd be happy to help"), no repeating the question back, no disclaimers unless safety actually requires one. Use plain, everyday words — explain like the person has no fitness or nutrition background. If they ask to change their plan, tell them to use the "Regenerate my plan" button instead of trying to edit it through chat.`;

/**
 * POST /api/coach/chat
 * Body: { message: string }
 * Returns: { reply: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

  const access = await getCoachAccess();
  if (!access.hasAccess) {
    return NextResponse.json(
      {
        error:
          access.deniedReason === "not_started"
            ? "Finish setting up your coach to start your free trial."
            : access.deniedReason === "cancelled"
              ? "Your subscription was cancelled. Resubscribe to continue."
              : "Your 14-day free trial is over. Subscribe to continue.",
        deniedReason: access.deniedReason,
      },
      { status: 403 }
    );
  }

  // Chat hits a real LLM per message — rate limit tighter than most routes.
  const { allowed, retryAfterMs } = checkRateLimit(`coach-chat:${user.id}`, 20, 5 * 60 * 1000);
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 60000);
    return NextResponse.json({ error: `Too many messages. Try again in ${mins} min.` }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` }, { status: 400 });
  }

  // Quota is claimed after validation (so a malformed request never costs an
  // allowance) but before the provider call (so an exhausted user never
  // reaches the model). 402 tells the client to show the paywall rather than
  // a generic error.
  const { granted } = await consumeQuota(supabase, access.tier, "chat");
  if (!granted) {
    return NextResponse.json(
      { error: exhaustedMessage(access.tier, "chat"), quotaExhausted: true, tier: access.tier },
      { status: 402 }
    );
  }

  const { data: recent } = await supabase
    .from("coach_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);

  const history: ChatMessage[] = (recent ?? [])
    .reverse()
    .map((m) => ({ role: m.role as ChatMessage["role"], content: m.content }));

  const { error: insertUserError } = await supabase
    .from("coach_messages")
    .insert({ user_id: user.id, role: "user", content: message });
  if (insertUserError) {
    await refundQuota(supabase, user.id, access.tier, "chat");
    return NextResponse.json({ error: "Failed to save your message." }, { status: 500 });
  }

  let reply: string;
  try {
    // Chat stays on the default fast model at every tier — only plan
    // generation is upgraded on Pro. See lib/coach/tiers.ts.
    const result = await chat([{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: message }], {
      temperature: 0.5,
    });
    reply = result.content.trim();
  } catch {
    // No reply was delivered, so the message shouldn't count against them.
    await refundQuota(supabase, user.id, access.tier, "chat");
    return NextResponse.json({ error: "The coach is unavailable right now. Please try again shortly." }, { status: 502 });
  }

  await supabase.from("coach_messages").insert({ user_id: user.id, role: "assistant", content: reply });

  return NextResponse.json({ reply });
}
