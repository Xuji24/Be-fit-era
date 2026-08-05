import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the post-login destination for a user based on their profile role.
 * Shared by the password sign-in action and the OAuth callback route so
 * both flows send admins to /admin consistently.
 */
export async function getPostLoginRedirect(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") {
    return "/admin";
  }

  return "/";
}
