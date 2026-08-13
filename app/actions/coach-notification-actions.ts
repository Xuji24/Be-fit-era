"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./coach-actions";

export interface NotificationPreferences {
  weeklyDigest: boolean;
  streakNudge: boolean;
  emailEnabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  weeklyDigest: true,
  streakNudge: true,
  emailEnabled: true,
};

/** A missing row means every default (enabled) applies — same opt-out model as the cron. */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFERENCES;

  const { data } = await supabase
    .from("notification_preferences")
    .select("coach_weekly_digest, coach_streak_nudge, coach_email_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return DEFAULT_PREFERENCES;

  return {
    weeklyDigest: data.coach_weekly_digest,
    streakNudge: data.coach_streak_nudge,
    emailEnabled: data.coach_email_enabled,
  };
}

export async function updateNotificationPreferences(prefs: NotificationPreferences): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in." };

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: user.id,
      coach_weekly_digest: prefs.weeklyDigest,
      coach_streak_nudge: prefs.streakNudge,
      coach_email_enabled: prefs.emailEnabled,
    },
    { onConflict: "user_id" }
  );

  if (error) return { success: false, error: "Failed to save your notification preferences." };

  revalidatePath("/settings");
  return { success: true };
}
