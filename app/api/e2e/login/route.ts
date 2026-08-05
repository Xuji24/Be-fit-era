import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Test-only route: bypasses hCaptcha for E2E authenticated tests.
// Disabled in production.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  // Step 1: use service role (bypasses captcha) to get a session for this user
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: signInData, error: signInError } =
    await admin.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session) {
    return NextResponse.json(
      { error: signInError?.message ?? "Sign-in failed" },
      { status: 401 },
    );
  }

  // Step 2: set the session into SSR cookies so Next.js middleware picks it up
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, sameSite: "lax", secure: false }),
          );
        },
      },
    },
  );

  await supabase.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });

  return response;
}
