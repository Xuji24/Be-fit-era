"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

type ActionResult = {
  success: boolean;
  error?: string;
};

async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

const VALID_SUBJECTS = [
  "general",
  "race-info",
  "partnership",
  "technical",
  "other",
] as const;

/**
 * Submit a contact form to the contact_submissions table.
 * Rate limited to 3 submissions per 15 minutes per IP.
 */
export async function submitContactForm(
  formData: FormData,
): Promise<ActionResult> {
  const ip = await getClientIp();
  const { allowed, retryAfterMs } = await checkRateLimit(`contact:${ip}`, 3);
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 60000);
    return {
      success: false,
      error: `Too many submissions. Try again in ${mins} min.`,
    };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const subject = formData.get("subject") as string;
  const message = (formData.get("message") as string)?.trim();

  if (!name || !email || !subject || !message) {
    return { success: false, error: "All fields are required." };
  }

  if (!VALID_SUBJECTS.includes(subject as (typeof VALID_SUBJECTS)[number])) {
    return { success: false, error: "Invalid subject." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Invalid email address." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("contact_submissions").insert({
    name,
    email,
    subject,
    message,
  });

  if (error) {
    return {
      success: false,
      error: "Failed to send message. Please try again.",
    };
  }

  return { success: true };
}

// ============================================================
// Race Registration
// ============================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_SHIRT_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
const VALID_PAYMENT_METHODS = ["gcash", "card", "bank"] as const;

interface RegistrationInput {
  raceId: string;
  fullName: string;
  email: string;
  phone: string;
  shirtSize: string;
  paymentMethod: string;
}

export async function registerForRace(
  input: RegistrationInput,
): Promise<ActionResult> {
  const ip = await getClientIp();
  const { allowed, retryAfterMs } = await checkRateLimit(`race-reg:${ip}`, 5);
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 60000);
    return {
      success: false,
      error: `Too many attempts. Try again in ${mins} min.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      success: false,
      error: "You must be logged in to register for a race.",
    };
  }

  // Validate inputs
  if (!UUID_REGEX.test(input.raceId)) {
    return { success: false, error: "Invalid race." };
  }
  if (!input.fullName.trim()) {
    return { success: false, error: "Full name is required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { success: false, error: "Invalid email address." };
  }
  if (!/^[0-9+\-\s()]{7,15}$/.test(input.phone.trim())) {
    return { success: false, error: "Invalid phone number." };
  }
  if (
    !VALID_SHIRT_SIZES.includes(
      input.shirtSize as (typeof VALID_SHIRT_SIZES)[number],
    )
  ) {
    return { success: false, error: "Invalid shirt size." };
  }
  if (
    !VALID_PAYMENT_METHODS.includes(
      input.paymentMethod as (typeof VALID_PAYMENT_METHODS)[number],
    )
  ) {
    return { success: false, error: "Invalid payment method." };
  }

  // register_for_race() does the race-exists, registration-open,
  // capacity, and already-registered checks atomically in one transaction —
  // see supabase/migrations/20260812000001_add_atomic_register_for_race.sql
  // for why this can't be a separate check-then-insert in app code.
  const { data: rpcData, error: rpcError } = await supabase
    .rpc("register_for_race", {
      p_race_id: input.raceId,
      p_full_name: input.fullName.trim(),
      p_email: input.email.trim(),
      p_phone: input.phone.trim(),
      p_shirt_size: input.shirtSize,
      p_payment_method: input.paymentMethod,
    })
    .single();

  if (rpcError) {
    return { success: false, error: "Registration failed. Please try again." };
  }

  const errorMessages: Record<string, string> = {
    unauthenticated: "You must be logged in to register for a race.",
    race_not_found: "Race not found.",
    registration_closed: "Registration is closed for this race.",
    race_full: "This race has reached its participant limit.",
    already_registered: "You are already registered for this race.",
  };

  const { registration_id, error_code } = rpcData as {
    registration_id: string | null;
    error_code: string | null;
  };

  if (error_code) {
    return {
      success: false,
      error: errorMessages[error_code] ?? "Registration failed. Please try again.",
    };
  }
  if (!registration_id) {
    return { success: false, error: "Registration failed. Please try again." };
  }

  sendEmail({
    to: input.email.trim(),
    subject: "Race Registration Confirmed!",
    message: "You have joined the race!",
  }).catch(console.error);

  return { success: true };
}

export async function checkRaceRegistration(
  raceId: string,
): Promise<{ registered: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { registered: false };

  const { data } = await supabase
    .from("race_registrations")
    .select("id")
    .eq("user_id", user.id)
    .eq("race_id", raceId)
    .maybeSingle();

  return { registered: !!data };
}

/* ── Organizer Application Actions ── */

interface OrganizerApplicationInput {
  organizationName: string;
  contactEmail: string;
  contactPhone?: string;
  description?: string;
  documentUrls: string[];
}

export async function submitOrganizerApplication(
  input: OrganizerApplicationInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { success: false, error: "You must be logged in to apply." };

  const { allowed, retryAfterMs } = await checkRateLimit(
    `organizer-apply:${user.id}`,
    3,
    60 * 60 * 1000,
  );
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 60000);
    return {
      success: false,
      error: `Too many applications. Try again in ${mins} min.`,
    };
  }

  // Validate inputs
  const orgName = input.organizationName?.trim();
  if (!orgName || orgName.length < 2 || orgName.length > 200)
    return {
      success: false,
      error: "Please provide a valid organization name.",
    };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.contactEmail || !emailRegex.test(input.contactEmail))
    return { success: false, error: "Please provide a valid contact email." };

  if (input.documentUrls.length === 0)
    return {
      success: false,
      error: "Please upload at least one proof document.",
    };

  if (input.documentUrls.length > 5)
    return {
      success: false,
      error: "You can upload a maximum of 5 documents.",
    };

  // Check if user already has a pending application
  const { data: existing } = await supabase
    .from("organizer_applications")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing)
    return {
      success: false,
      error: "You already have a pending application under review.",
    };

  // Check if user is already an organizer
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "organizer" || profile?.role === "admin")
    return {
      success: false,
      error: "Your account already has organizer privileges.",
    };

  const { error } = await supabase.from("organizer_applications").insert({
    user_id: user.id,
    organization_name: orgName,
    contact_email: input.contactEmail.trim(),
    contact_phone: input.contactPhone?.trim() || null,
    description: input.description?.trim() || null,
    document_urls: input.documentUrls,
  });

  if (error)
    return {
      success: false,
      error: "Unable to submit your application. Please try again.",
    };

  return { success: true };
}

export async function getOrganizerApplicationStatus(): Promise<{
  status: "none" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "none" };

  const { data } = await supabase
    .from("organizer_applications")
    .select("status, rejection_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { status: "none" };

  return {
    status: data.status as "pending" | "approved" | "rejected",
    rejectionReason: data.rejection_reason ?? undefined,
  };
}

export async function getUserRole(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "runner";

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return data?.role ?? "runner";
}



export async function getRecentActivitiesForRace(raceDbId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('activity_entries').select('id, user_id, distance_km, activity_type, activity_date, created_at, source, user:profiles!activity_entries_user_id_fkey(full_name, avatar_url), registration:race_registrations!inner(race_id)').eq('registration.race_id', raceDbId).order('created_at', { ascending: false }).limit(20);
  if (error) return { success: false, error: error.message };
  return { success: true, data: data.map((d: {
    id: string;
    user_id: string;
    distance_km: number;
    activity_type: string;
    activity_date: string;
    created_at: string;
    source: string;
    user: { full_name: string; avatar_url: string }[] | null;
    registration: { race_id: string }[] | null;
  }) => ({...d, runner_name: d.user?.[0]?.full_name || 'Anonymous', avatar: d.user?.[0]?.avatar_url})) };
}

export async function flagActivity(activityId: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const { error } = await supabase.from('activity_entries').update({ is_flagged: true, flag_reason: reason, reported_by: user.id }).eq('id', activityId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/* ──────────────────────────────────────────────────────────
   Leaderboard — paginated server action
   ────────────────────────────────────────────────────────── */

export interface LeaderboardRow {
  rank: number;
  user: string;
  username: string;
  pacing: string;
  distance: string;
  lastRun: string;
}

export async function getLeaderboardPage(
  page: number = 1,
  limit: number = 20,
): Promise<{ data: LeaderboardRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from("leaderboard_entries")
    .select(
      "rank, total_distance_km, avg_pace, last_run_date, profiles(full_name, username)",
      { count: "exact" },
    )
    .order("rank")
    .range(from, to);

  if (error) return { data: [], total: 0 };

  const rows: LeaderboardRow[] = (data ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      full_name: string;
      username: string;
    } | null;
    return {
      rank: row.rank ?? 0,
      user: profile?.full_name ?? "Unknown",
      username: profile?.username ? `@${profile.username}` : "@unknown",
      pacing: row.avg_pace ?? "—",
      distance: `${Math.round(Number(row.total_distance_km))}km`,
      lastRun: row.last_run_date
        ? new Date(row.last_run_date).toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
            year: "numeric",
          })
        : "—",
    };
  });

  return { data: rows, total: count ?? 0 };
}

/* ──────────────────────────────────────────────────────────
   Race Cancellation (Organizer / Admin)
   ────────────────────────────────────────────────────────── */

export async function cancelRace(
  raceId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: race } = await supabase
    .from("races")
    .select("organizer_id, status")
    .eq("id", raceId)
    .single();

  if (!race) return { success: false, error: "Race not found" };
  if (race.status === "cancelled")
    return { success: false, error: "Race is already cancelled" };

  const isOrganizer = race.organizer_id === user.id;
  const isAdmin = profile?.role === "admin";
  if (!isOrganizer && !isAdmin)
    return { success: false, error: "Only the organizer or admin can cancel a race" };

  const { error: raceErr } = await supabase
    .from("races")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
      cancelled_by: user.id,
    })
    .eq("id", raceId);

  if (raceErr) return { success: false, error: raceErr.message };

  const { error: regErr } = await supabase
    .from("race_registrations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: `Race cancelled: ${reason}`,
    })
    .eq("race_id", raceId)
    .neq("status", "cancelled");

  if (regErr) return { success: false, error: regErr.message };

  revalidatePath("/race");
  revalidatePath("/organizer");
  revalidatePath("/admin");
  return { success: true };
}

export async function cancelRegistration(
  registrationId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: reg } = await supabase
    .from("race_registrations")
    .select("user_id, status")
    .eq("id", registrationId)
    .single();

  if (!reg) return { success: false, error: "Registration not found" };
  if (reg.user_id !== user.id)
    return { success: false, error: "You can only cancel your own registration" };
  if (reg.status === "cancelled")
    return { success: false, error: "Registration is already cancelled" };

  const { error } = await supabase
    .from("race_registrations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq("id", registrationId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/activities");
  revalidatePath("/race");
  return { success: true };
}
