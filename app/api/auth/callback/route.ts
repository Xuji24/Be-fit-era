import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginRedirect } from "@/lib/supabase/roles";

/**
 * GET /api/auth/callback
 *
 * Handles the OAuth/PKCE callback from Supabase Auth.
 * Used by:
 *   - Email confirmation links (signUp with PKCE flow)
 *   - Google OAuth redirect
 *   - Password reset email links
 *
 * Supabase appends `?code=...` to the redirect URL.
 * This route exchanges that code for a session, then redirects
 * the user to the appropriate page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset

  // Validate redirect target to prevent open redirects
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset flow → redirect to reset-password page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      // Email signup verification → redirect to login with verified flag
      if (type === "signup") {
        return NextResponse.redirect(`${origin}/login?verified=true`);
      }
      // Normal flow (OAuth, etc.) → send admins to /admin, others to `next`
      const target =
        rawNext === "/" && user
          ? await getPostLoginRedirect(supabase, user.id)
          : next;
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  // Auth code exchange failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
