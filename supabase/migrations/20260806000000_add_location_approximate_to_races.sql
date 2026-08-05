-- Distinguishes an organizer-placed pin from a geocoded/backfilled estimate,
-- so the map can render precision honestly instead of claiming an exact
-- start point it doesn't actually have.
ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS location_approximate BOOLEAN NOT NULL DEFAULT false;

-- Existing coordinates on these races were backfilled from a rough city-level
-- lookup, not placed by the organizer on the map — flag them as approximate.
UPDATE public.races
SET location_approximate = true
WHERE id IN (
  'a1b2c3d4-0001-4000-8000-000000000001',
  'a1b2c3d4-0002-4000-8000-000000000002',
  'a1b2c3d4-0003-4000-8000-000000000003',
  'a1b2c3d4-0004-4000-8000-000000000004',
  'a1b2c3d4-0005-4000-8000-000000000005'
);
