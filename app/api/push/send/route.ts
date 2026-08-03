import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? "mailto:admin@befitiera.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? "",
);

interface SendPushBody {
  /** Optional: target a specific user. If omitted, broadcast to all. */
  userId?: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

async function isAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return profile?.role === "admin";
}

function isServiceRequest(req: Request): boolean {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret) return false;
  return req.headers.get("x-service-secret") === secret;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const serviceAuthorized = isServiceRequest(req);

  if (!serviceAuthorized) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdmin(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let payload: SendPushBody;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!payload.title?.trim() || !payload.body?.trim()) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 },
    );
  }

  let query = supabase
    .from("push_subscriptions")
    .select("endpoint, auth, p256dh");
  if (payload.userId) query = query.eq("user_id", payload.userId);

  const { data: subs, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    icon: payload.icon,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { auth: sub.auth, p256dh: sub.p256dh },
        },
        notification,
      ),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent, total: subs.length });
}
