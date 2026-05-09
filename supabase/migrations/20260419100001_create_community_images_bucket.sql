-- ============================================================
-- Migration: Create Storage Bucket for Community Post Images
-- ============================================================

-- Create the community-images bucket (public so images can be displayed)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('community-images', 'community-images', true, 5242880) -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload community images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-images');

-- RLS: Allow anyone to view community images (public bucket)
CREATE POLICY "Anyone can view community images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'community-images');

-- RLS: Allow users to delete their own uploaded images
CREATE POLICY "Users can delete their own community images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
