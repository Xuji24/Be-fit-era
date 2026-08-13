-- registerForRace() in app/actions/main-actions.ts previously checked
-- registration_open, "already registered", and (never) capacity, then did a
-- separate insert. Capacity was never checked at all, so races could oversell
-- past max_participants indefinitely. Folding the whole registration into one
-- function — with `SELECT ... FOR UPDATE` locking the race row — makes the
-- capacity check and the insert atomic relative to concurrent signups for the
-- same race, the same way consume_coach_quota() is atomic for quota.
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

  if v_max_participants is not null then
    select count(*) into v_current_count
    from public.race_registrations
    where race_id = p_race_id and status <> 'cancelled';

    if v_current_count >= v_max_participants then
      return query select null::uuid, 'race_full'::text;
      return;
    end if;
  end if;

  insert into public.race_registrations
    (user_id, race_id, full_name, email, phone, shirt_size, payment_method, status)
  values
    (v_user_id, p_race_id, p_full_name, p_email, p_phone, p_shirt_size, p_payment_method, 'upcoming')
  returning id into v_new_id;

  return query select v_new_id, null::text;
exception
  when unique_violation then
    return query select null::uuid, 'already_registered'::text;
end;
$$;

comment on function public.register_for_race is
  'Atomic race signup: locks the race row, checks registration_open + capacity, then inserts. Replaces a check-then-insert in app/actions/main-actions.ts that never enforced max_participants at all.';

revoke all on function public.register_for_race(uuid, text, text, text, text, text) from public;
revoke all on function public.register_for_race(uuid, text, text, text, text, text) from anon;
grant execute on function public.register_for_race(uuid, text, text, text, text, text) to authenticated;
