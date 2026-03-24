"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export type ActionResult = {
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

/* ── Create Race (Organizer Only) ── */

export interface CreateRaceInput {
  title: string;
  category: string;
  targetDistance: number;
  eventDate: string;
  location?: string;
  description?: string;
  maxParticipants?: number;
  registrationDeadline?: string;
  tshirtDesignUrl?: string;
  medalDesignUrl?: string;
  certificateDesignUrl?: string;
}

type CreateRaceResult = ActionResult & { raceId?: string };

export async function createRace(
  input: CreateRaceInput,
): Promise<CreateRaceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { success: false, error: "You must be logged in to create a race." };

  // Verify organizer role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "organizer" && profile?.role !== "admin")
    return {
      success: false,
      error: "You do not have permission to create races.",
    };

  const ip = await getClientIp();
  const allowed = checkRateLimit(`create-race:${user.id}`, 10, 60 * 60 * 1000);
  if (!allowed)
    return {
      success: false,
      error: "Too many requests. Please try again later.",
    };

  // Validate inputs
  const title = input.title?.trim();
  if (!title || title.length < 3 || title.length > 200)
    return {
      success: false,
      error: "Please provide a valid race title (3–200 characters).",
    };

  const validCategories = ["5K", "10K", "Half Marathon", "Marathon", "Ultra"];
  if (!validCategories.includes(input.category))
    return { success: false, error: "Please select a valid category." };

  if (
    !input.targetDistance ||
    input.targetDistance <= 0 ||
    input.targetDistance > 1000
  )
    return {
      success: false,
      error: "Please provide a valid distance (0.1–1000 km).",
    };

  if (!input.eventDate)
    return { success: false, error: "Please provide an event date." };

  const insertData: Record<string, unknown> = {
    title,
    organizer: user.id,
    category: input.category,
    target_distance_km: input.targetDistance,
    event_date: input.eventDate,
    registration_open: true,
  };

  if (input.location) insertData.location = input.location;
  if (input.description) insertData.description = input.description;
  if (input.maxParticipants && input.maxParticipants > 0)
    insertData.max_participants = input.maxParticipants;
  if (input.registrationDeadline)
    insertData.registration_deadline = input.registrationDeadline;
  if (input.tshirtDesignUrl)
    insertData.tshirt_design_url = input.tshirtDesignUrl;
  if (input.medalDesignUrl) insertData.medal_design_url = input.medalDesignUrl;
  if (input.certificateDesignUrl)
    insertData.certificate_design_url = input.certificateDesignUrl;

  const { data, error } = await supabase
    .from("races")
    .insert(insertData)
    .select("id")
    .single();

  if (error)
    return {
      success: false,
      error: "Unable to create race. Please try again.",
    };

  revalidatePath("/organizer");
  revalidatePath("/race");

  return { success: true, raceId: data.id };
}

/* ── Update Race (Organizer/Admin) ── */

export interface UpdateRaceInput extends Partial<CreateRaceInput> {
  raceId: string;
}

export async function updateRace(
  input: UpdateRaceInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { success: false, error: "You must be logged in to update a race." };

  // Verify organizer role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "organizer" && profile?.role !== "admin")
    return {
      success: false,
      error: "You do not have permission to update races.",
    };

  const ip = await getClientIp();
  const allowed = checkRateLimit(`update-race:${user.id}`, 20, 60 * 60 * 1000);
  if (!allowed)
    return {
      success: false,
      error: "Too many requests. Please try again later.",
    };

  // Verify the race belongs to this organizer (or user is admin)
  const { data: race, error: raceError } = await supabase
    .from("races")
    .select("organizer")
    .eq("id", input.raceId)
    .single();

  if (raceError || !race) return { success: false, error: "Race not found." };

  if (race.organizer !== user.id && profile?.role !== "admin")
    return { success: false, error: "You can only update your own races." };

  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) {
    const title = input.title?.trim();
    if (!title || title.length < 3 || title.length > 200)
      return {
        success: false,
        error: "Please provide a valid race title (3–200 characters).",
      };
    updateData.title = title;
  }

  if (input.category !== undefined) {
    const validCategories = ["5K", "10K", "Half Marathon", "Marathon", "Ultra"];
    if (!validCategories.includes(input.category))
      return { success: false, error: "Please select a valid category." };
    updateData.category = input.category;
  }

  if (input.targetDistance !== undefined) {
    if (input.targetDistance <= 0 || input.targetDistance > 1000)
      return {
        success: false,
        error: "Please provide a valid distance (0.1–1000 km).",
      };
    updateData.target_distance_km = input.targetDistance;
  }

  if (input.eventDate !== undefined) {
    if (!input.eventDate)
      return { success: false, error: "Please provide an event date." };
    updateData.event_date = input.eventDate;
  }

  if (input.location !== undefined) updateData.location = input.location;
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.maxParticipants !== undefined)
    updateData.max_participants = input.maxParticipants;
  if (input.registrationDeadline !== undefined)
    updateData.registration_deadline = input.registrationDeadline;
  if (input.tshirtDesignUrl !== undefined)
    updateData.tshirt_design_url = input.tshirtDesignUrl;
  if (input.medalDesignUrl !== undefined)
    updateData.medal_design_url = input.medalDesignUrl;
  if (input.certificateDesignUrl !== undefined)
    updateData.certificate_design_url = input.certificateDesignUrl;

  if (Object.keys(updateData).length === 0)
    return { success: false, error: "No changes to save." };

  const { error } = await supabase
    .from("races")
    .update(updateData)
    .eq("id", input.raceId);

  if (error)
    return {
      success: false,
      error: "Unable to update race. Please try again.",
    };

  revalidatePath("/organizer");
  revalidatePath(`/race/${input.raceId}`);

  return { success: true };
}

/* ── Update Race Designs (Organizer Only) ── */

export interface UpdateRaceDesignsInput {
  raceId: string;
  tshirtDesignUrl?: string | null;
  medalDesignUrl?: string | null;
  certificateDesignUrl?: string | null;
}

export async function updateRaceDesigns(
  input: UpdateRaceDesignsInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { success: false, error: "You must be logged in." };

  // Verify organizer role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "organizer" && profile?.role !== "admin")
    return { success: false, error: "You do not have permission to update races." };

  // Verify the race belongs to this organizer
  const { data: race } = await supabase
    .from("races")
    .select("organizer")
    .eq("id", input.raceId)
    .single();

  if (!race)
    return { success: false, error: "Race not found." };

  if (race.organizer !== user.id && profile?.role !== "admin")
    return { success: false, error: "You can only update your own races." };

  const updateData: Record<string, unknown> = {};
  if (input.tshirtDesignUrl !== undefined)
    updateData.tshirt_design_url = input.tshirtDesignUrl;
  if (input.medalDesignUrl !== undefined)
    updateData.medal_design_url = input.medalDesignUrl;
  if (input.certificateDesignUrl !== undefined)
    updateData.certificate_design_url = input.certificateDesignUrl;

  if (Object.keys(updateData).length === 0)
    return { success: false, error: "No changes to save." };

  const { error } = await supabase
    .from("races")
    .update(updateData)
    .eq("id", input.raceId);

  if (error)
    return { success: false, error: "Unable to update designs. Please try again." };

  revalidatePath("/organizer");
  revalidatePath(`/race/${input.raceId}`);

  return { success: true };
}
