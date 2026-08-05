"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";

export type ActionResult = {
  success: boolean;
  error?: string;
};

function hasValidCoords(lat?: number, lng?: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/* ── Create Race (Organizer Only) ── */

export interface CreateRaceInput {
  title: string;
  category: string;
  targetDistance: number;
  eventDate: string;
  eventTime?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  maxParticipants?: number;
  registrationDeadline?: string;
  tshirtDesignUrl?: string;
  medalDesignUrl?: string;
  certificateDesignUrl?: string;
  registrationFee?: number;
  cutoffTimeMinutes?: number;
  kitPickupInfo?: string;
  inclusions?: string[];
  gpxUrl?: string;
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

  const { allowed, retryAfterMs } = checkRateLimit(
    `create-race:${user.id}`,
    10,
    60 * 60 * 1000,
  );
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 60000);
    return {
      success: false,
      error: `Too many requests. Try again in ${mins} min.`,
    };
  }

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

  if (input.eventTime) insertData.event_time = input.eventTime;
  if (input.location) insertData.location = input.location;
  if (input.latitude !== undefined || input.longitude !== undefined) {
    if (!hasValidCoords(input.latitude, input.longitude))
      return { success: false, error: "Please select a valid map location." };
    insertData.latitude = input.latitude;
    insertData.longitude = input.longitude;
  }
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
  if (input.registrationFee !== undefined)
    insertData.registration_fee = input.registrationFee;
  if (input.cutoffTimeMinutes !== undefined)
    insertData.cutoff_time_minutes = input.cutoffTimeMinutes;
  if (input.kitPickupInfo) insertData.kit_pickup_info = input.kitPickupInfo;
  if (input.inclusions && input.inclusions.length > 0)
    insertData.inclusions = input.inclusions;
  if (input.gpxUrl) insertData.gpx_url = input.gpxUrl;

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

export interface UpdateRaceInput
  extends Omit<Partial<CreateRaceInput>, "latitude" | "longitude"> {
  raceId: string;
  // null clears a previously pinned location
  latitude?: number | null;
  longitude?: number | null;
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

  const { allowed, retryAfterMs } = checkRateLimit(
    `update-race:${user.id}`,
    20,
    60 * 60 * 1000,
  );
  if (!allowed) {
    const mins = Math.ceil(retryAfterMs / 60000);
    return {
      success: false,
      error: `Too many requests. Try again in ${mins} min.`,
    };
  }

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
  if (input.latitude !== undefined || input.longitude !== undefined) {
    if (input.latitude === null || input.longitude === null) {
      updateData.latitude = null;
      updateData.longitude = null;
    } else {
      if (!hasValidCoords(input.latitude, input.longitude))
        return { success: false, error: "Please select a valid map location." };
      updateData.latitude = input.latitude;
      updateData.longitude = input.longitude;
    }
    // A pin placed (or cleared) through the map picker is never a rough
    // estimate — clear any prior "approximate" flag set by a backfill.
    updateData.location_approximate = false;
  }
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
  if (input.eventTime !== undefined) updateData.event_time = input.eventTime;
  if (input.registrationFee !== undefined)
    updateData.registration_fee = input.registrationFee;
  if (input.cutoffTimeMinutes !== undefined)
    updateData.cutoff_time_minutes = input.cutoffTimeMinutes;
  if (input.kitPickupInfo !== undefined)
    updateData.kit_pickup_info = input.kitPickupInfo;
  if (input.inclusions !== undefined) updateData.inclusions = input.inclusions;
  if (input.gpxUrl !== undefined) updateData.gpx_url = input.gpxUrl;

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
