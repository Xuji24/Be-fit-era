-- Add gpx_url column to races so organizers can attach a GPX route file.
ALTER TABLE public.races
  ADD COLUMN IF NOT EXISTS gpx_url TEXT;

-- Create storage bucket for GPX files (public read, authenticated write).
INSERT INTO storage.buckets (id, name, public)
VALUES ('race-gpx', 'race-gpx', true)
ON CONFLICT (id) DO NOTHING;

-- Organizers can upload GPX files for their own races.
CREATE POLICY "Organizers can upload GPX files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'race-gpx' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Organizers can update/delete their own GPX files.
CREATE POLICY "Organizers can update their GPX files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'race-gpx' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Organizers can delete their GPX files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'race-gpx' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Anyone can read GPX files (needed for public race detail page).
CREATE POLICY "Public read GPX files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'race-gpx');
