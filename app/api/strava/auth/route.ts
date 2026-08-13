import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * GET /api/strava/auth
 *
 * Redirects the user to Strava's OAuth authorization page.
 * Strava will ask the user to grant permission, then redirect
 * back to our callback URL with an authorization code.
 */
export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Strava API credentials not configured" },
      { status: 500 }
    );
  }

  // CSRF guard for the account-linking flow: a nonce is minted here, handed
  // to Strava as `state`, and stashed in a short-lived httpOnly cookie. The
  // callback rejects any request whose `state` doesn't match this cookie, so
  // an attacker can't hand a victim's browser a code that links the
  // attacker's Strava account onto the victim's session.
  const state = randomBytes(24).toString("hex");

  const stravaAuthUrl = new URL("https://www.strava.com/oauth/authorize");
  stravaAuthUrl.searchParams.set("client_id", clientId);
  stravaAuthUrl.searchParams.set("redirect_uri", redirectUri);
  stravaAuthUrl.searchParams.set("response_type", "code");
  stravaAuthUrl.searchParams.set("scope", "read,activity:read_all");
  stravaAuthUrl.searchParams.set("approval_prompt", "auto");
  stravaAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(stravaAuthUrl.toString());
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/strava",
    maxAge: 600, // 10 minutes — long enough to complete the Strava consent screen
  });
  return response;
}
