-- Create the sponsor-logos storage bucket for sponsor logo uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sponsor-logos',
  'sponsor-logos',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Only admins can upload sponsor logos
CREATE POLICY "sponsor_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sponsor-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Anyone can read (bucket is public)
CREATE POLICY "sponsor_logos_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'sponsor-logos');

-- Only admins can update sponsor logos
CREATE POLICY "sponsor_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sponsor-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Only admins can delete sponsor logos
CREATE POLICY "sponsor_logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sponsor-logos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
