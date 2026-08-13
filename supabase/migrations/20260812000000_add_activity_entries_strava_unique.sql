-- Closes a TOCTOU race in POST /api/strava/import: the route checks for an
-- existing row by (user_id, strava_activity_id) and then inserts, but two
-- concurrent requests for the same activity could both pass the check and
-- both insert, double-crediting the same run's distance toward a race.
--
-- Postgres treats NULLs as distinct under UNIQUE, so manually-logged entries
-- (strava_activity_id IS NULL) are unaffected — this only constrains rows
-- that actually came from Strava.
alter table public.activity_entries
  add constraint activity_entries_user_strava_activity_key
  unique (user_id, strava_activity_id);
