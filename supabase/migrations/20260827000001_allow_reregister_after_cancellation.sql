-- ============================================================
-- Migration: Allow re-registering for a race after a cancelled
-- registration, and reuse the row instead of erroring
-- ============================================================
--
-- register_for_race() previously relied on the table's UNIQUE(user_id,
-- race_id) constraint + a `unique_violation` exception handler to detect
-- "already registered" — but that constraint doesn't distinguish an active
-- registration from a cancelled one, so ANY prior registration (even a
-- cancelled one) permanently blocked a user from ever registering for that
-- race again.
--
-- This was a low-impact latent bug while cancellation was rare and manual.
-- It becomes a guaranteed regression once expire-stale-payments (the new
-- cron) starts auto-cancelling abandoned/failed payments: a user whose
-- connection drops mid-checkout would otherwise be permanently locked out of
-- a race they never actually got to pay for.

create or replace function public.register_for_race(
  p_race_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_shirt_size text,
  p_payment_method text
) returns table(registration_id uuid, error_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_max_participants int;
  v_registration_open boolean;
  v_current_count int;
  v_new_id uuid;
  v_cancelled_id uuid;
begin
  if v_user_id is null then
    return query select null::uuid, 'unauthenticated'::text;
    return;
  end if;

  -- Row lock: a second concurrent call for the same race blocks here until
  -- the first transaction commits or rolls back, so the count below can't be
  -- read stale by two requests racing for the last slot.
  select max_participants, registration_open
    into v_max_participants, v_registration_open
  from public.races
  where id = p_race_id
  for update;

  if not found then
    return query select null::uuid, 'race_not_found'::text;
    return;
  end if;

  if not v_registration_open then
    return query select null::uuid, 'registration_closed'::text;
    return;
  end if;

  -- An active (non-cancelled) registration already exists — genuinely
  -- already registered.
  if exists (
    select 1 from public.race_registrations
    where user_id = v_user_id and race_id = p_race_id and status <> 'cancelled'
  ) then
    return query select null::uuid, 'already_registered'::text;
    return;
  end if;

  if v_max_participants is not null then
    select count(*) into v_current_count
    from public.race_registrations
    where race_id = p_race_id and status <> 'cancelled';

    if v_current_count >= v_max_participants then
      return query select null::uuid, 'race_full'::text;
      return;
    end if;
  end if;

  -- A cancelled registration for this (user, race) pair already exists —
  -- reuse it instead of inserting, since UNIQUE(user_id, race_id) would
  -- otherwise reject a second insert.
  select id into v_cancelled_id
  from public.race_registrations
  where user_id = v_user_id and race_id = p_race_id and status = 'cancelled'
  limit 1;

  if v_cancelled_id is not null then
    update public.race_registrations
    set full_name = p_full_name,
        email = p_email,
        phone = p_phone,
        shirt_size = p_shirt_size,
        payment_method = p_payment_method,
        status = 'upcoming',
        payment_status = 'pending',
        paymongo_session_id = null,
        cancelled_at = null,
        cancellation_reason = null,
        registered_at = now()
    where id = v_cancelled_id
    returning id into v_new_id;

    return query select v_new_id, null::text;
    return;
  end if;

  insert into public.race_registrations
    (user_id, race_id, full_name, email, phone, shirt_size, payment_method, status)
  values
    (v_user_id, p_race_id, p_full_name, p_email, p_phone, p_shirt_size, p_payment_method, 'upcoming')
  returning id into v_new_id;

  return query select v_new_id, null::text;
end;
$$;

comment on function public.register_for_race is
  'Atomic race signup: locks the race row, checks registration_open + capacity + already-registered, reuses a cancelled registration row if one exists, otherwise inserts.';

revoke all on function public.register_for_race(uuid, text, text, text, text, text) from public;
revoke all on function public.register_for_race(uuid, text, text, text, text, text) from anon;
grant execute on function public.register_for_race(uuid, text, text, text, text, text) to authenticated;
