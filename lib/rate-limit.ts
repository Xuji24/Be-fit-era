import { createClient } from "@/lib/supabase/server";

/**
 * Fixed-window rate limiter backed by check_rate_limit() in Postgres — see
 * supabase/migrations/20260812000002_create_rate_limit_hits.sql. Replaces a
 * plain in-memory Map, which only held a limit within one warm serverless
 * instance and didn't sync across concurrent instances on Vercel.
 *
 * Fails open on infra errors: a rate limiter that blocks all traffic when
 * the DB hiccups is worse than one that occasionally under-throttles. This
 * is a defense-in-depth throttle, not the sole guard against abuse.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number = 15 * 60 * 1000
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("check_rate_limit", {
        p_key: key,
        p_max_attempts: maxAttempts,
        p_window_ms: windowMs,
      })
      .single();

    if (error || !data) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const row = data as { allowed: boolean; retry_after_ms: number };
    return { allowed: row.allowed, retryAfterMs: Number(row.retry_after_ms) };
  } catch {
    return { allowed: true, retryAfterMs: 0 };
  }
}
