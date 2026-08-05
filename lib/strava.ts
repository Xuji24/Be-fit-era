import { SupabaseClient } from "@supabase/supabase-js";

interface StravaConnection {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface RefreshedTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
}

/**
 * Returns a valid Strava access token for the user, refreshing if expired.
 * Updates the DB row with new tokens when refreshed.
 * Returns null if the connection is missing or the refresh fails.
 */
export async function getStravaAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from("strava_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single<StravaConnection>();

  if (error || !connection) return null;

  if (new Date(connection.expires_at) > new Date()) {
    return connection.access_token;
  }

  const refreshed = await refreshStravaToken(connection.refresh_token);
  if (!refreshed) return null;

  await supabase
    .from("strava_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.access_token;
}

async function refreshStravaToken(
  refreshToken: string,
): Promise<RefreshedTokens | null> {
  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetches a single Strava activity by ID and returns its distance in km.
 * Returns null if the activity cannot be fetched.
 */
export async function fetchStravaActivityDistanceKm(
  accessToken: string,
  stravaActivityId: number,
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${stravaActivityId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.distance !== "number") return null;
    return +(data.distance / 1000).toFixed(2); // meters → km
  } catch {
    return null;
  }
}
