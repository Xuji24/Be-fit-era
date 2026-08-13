-- lib/rate-limit.ts was a plain in-memory Map: it resets on cold start and
-- doesn't sync across serverless instances, so on Vercel it's a soft speed
-- bump rather than real protection for signIn/signUp/coach-chat/checkout.
-- This moves the counter into Postgres with the same atomic
-- INSERT ... ON CONFLICT ... RETURNING pattern as consume_coach_quota(), so
-- concurrent requests across instances see a consistent count.
--
-- Fixed-window (not sliding-window like the old in-memory version) — simpler
-- to make atomic, and a burst at a window boundary is an acceptable
-- trade-off for what's a defense-in-depth throttle, not the sole guard.
create table if not exists public.rate_limit_hits (
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 1,
  primary key (key, window_start)
);

comment on table public.rate_limit_hits is
  'Atomic counters backing lib/rate-limit.ts. Rows are cheap and self-prune via check_rate_limit()''s opportunistic cleanup — no cron needed.';

create index if not exists idx_rate_limit_hits_window_start
  on public.rate_limit_hits (window_start);

-- RLS enabled, zero policies: direct PostgREST access is fully locked out
-- (same pattern as coach_notification_log) — the only door in is the
-- SECURITY DEFINER function below, which is where the actual logic lives.
alter table public.rate_limit_hits enable row level security;

create or replace function public.check_rate_limit(
  p_key text,
  p_max_attempts int,
  p_window_ms bigint
) returns table(allowed boolean, retry_after_ms bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_window_end   timestamptz;
  v_count        int;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms / 1000.0
  );
  v_window_end := v_window_start + (p_window_ms || ' milliseconds')::interval;

  insert into public.rate_limit_hits (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update
    set count = public.rate_limit_hits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup, no cron required — cheap at this table's scale.
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 hour';
  end if;

  if v_count > p_max_attempts then
    return query select false, greatest(0, (extract(epoch from (v_window_end - now())) * 1000))::bigint;
  else
    return query select true, 0::bigint;
  end if;
end;
$$;

comment on function public.check_rate_limit is
  'Atomic fixed-window rate limiter backing lib/rate-limit.ts. Callable by anon too — signIn/signUp/forgotPw are rate-limited before the caller has a session.';

revoke all on function public.check_rate_limit(text, int, bigint) from public;
grant execute on function public.check_rate_limit(text, int, bigint) to anon;
grant execute on function public.check_rate_limit(text, int, bigint) to authenticated;
