import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getStravaAccessToken,
  fetchStravaActivityDistanceKm,
} from "@/lib/strava";

/**
 * POST /api/strava/import
 *
 * Imports a Strava activity into a specific race registration.
 * Distance is verified against the real Strava API — the client-supplied
 * value is ignored in favour of Strava's authoritative distance.
 *
 * Body: {
 *   stravaActivityId: number,
 *   registrationId: string (UUID),
 *   activityType: "run" | "walk" | "cycle",
 *   activityDate: string (ISO date),
 *   activityName: string
 * }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { stravaActivityId, registrationId, activityType, activityDate, activityName } =
    body;

  if (!stravaActivityId || !registrationId || !activityType || !activityDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Verify the registration belongs to this user
  const { data: registration, error: regError } = await supabase
    .from("race_registrations")
    .select("id, user_id, race_id")
    .eq("id", registrationId)
    .eq("user_id", user.id)
    .single();

  if (regError || !registration) {
    return NextResponse.json(
      { error: "Race registration not found" },
      { status: 404 },
    );
  }

  // Fetch the race for date-range validation
  const { data: race } = await supabase
    .from("races")
    .select("event_date, target_distance_km")
    .eq("id", registration.race_id)
    .single();

  // Validate activity date is within allowed range (race start → today)
  if (race?.event_date) {
    const raceStart = new Date(race.event_date);
    raceStart.setUTCHours(0, 0, 0, 0);
    const actDate = new Date(activityDate);
    actDate.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);

    if (actDate < raceStart) {
      return NextResponse.json(
        { error: "Activity date cannot be before the race start date" },
        { status: 400 },
      );
    }
    if (actDate > today) {
      return NextResponse.json(
        { error: "Activity date cannot be in the future" },
        { status: 400 },
      );
    }
  }

  // Check for duplicate import
  const { data: existing } = await supabase
    .from("activity_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("strava_activity_id", stravaActivityId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This Strava activity has already been imported" },
      { status: 409 },
    );
  }

  // --- Phase 2: verify distance via Strava API ---
  const accessToken = await getStravaAccessToken(supabase, user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Strava not connected or token could not be refreshed" },
      { status: 401 },
    );
  }

  const verifiedDistanceKm = await fetchStravaActivityDistanceKm(
    accessToken,
    Number(stravaActivityId),
  );

  if (verifiedDistanceKm === null) {
    return NextResponse.json(
      { error: "Could not verify activity distance with Strava" },
      { status: 422 },
    );
  }

  // Guard: activity must belong to this athlete — Strava returns 404 for
  // activities the token's owner did not perform, so a null above already
  // covers that case. Double-check distance is positive and finite.
  if (!Number.isFinite(verifiedDistanceKm) || verifiedDistanceKm <= 0) {
    return NextResponse.json(
      { error: "Invalid distance reported by Strava" },
      { status: 400 },
    );
  }

  // Soft cap: verified distance still cannot wildly exceed the race target
  // (protects against test/virtual activities tagged to a different race)
  const targetKm = Number(race?.target_distance_km);
  if (Number.isFinite(targetKm) && targetKm > 0) {
    const maxDistance = targetKm * 2;
    if (verifiedDistanceKm > maxDistance) {
      return NextResponse.json(
        { error: `Distance cannot exceed ${maxDistance} km for this race` },
        { status: 400 },
      );
    }
  }

  // Insert the activity entry using the Strava-verified distance
  const { data: entry, error: insertError } = await supabase
    .from("activity_entries")
    .insert({
      user_id: user.id,
      registration_id: registrationId,
      activity_type: activityType,
      distance_km: verifiedDistanceKm,
      activity_date: activityDate,
      notes: `Imported from Strava: ${activityName}`,
      strava_activity_id: stravaActivityId,
      source: "strava",
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to import Strava activity:", insertError);
    return NextResponse.json(
      { error: "Failed to import activity" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    entry,
    message: `+${verifiedDistanceKm} km logged from Strava`,
  });
}
