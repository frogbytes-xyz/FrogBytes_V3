-- Update pdfs storage bucket to ensure proper CORS configuration
-- This fixes PDF viewing in the react-pdf component

-- Update bucket to ensure it's public
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 52428800, -- 50MB limit
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'pdfs';

-- Ensure CORS is allowed for the bucket
-- Note: CORS configuration is typically done through Supabase Dashboard or API
-- This SQL just ensures the bucket itself is properly configured

-- Verify public read access policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public can view PDFs if shared'
  ) THEN
    CREATE POLICY "Public can view PDFs if shared"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'pdfs');
  END IF;
END $$;

-- Add policy for anonymous users to view PDFs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Anyone can view PDFs'
  ) THEN
    CREATE POLICY "Anyone can view PDFs"
    ON storage.objects FOR SELECT
    TO anon, public, authenticated
    USING (bucket_id = 'pdfs');
  END IF;
END $$;
