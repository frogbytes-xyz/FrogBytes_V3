-- Ensure pdfs bucket has proper public access and CORS configuration
-- This migration ensures that PDFs can be accessed from the frontend without authentication

-- Update bucket to be public with proper configuration
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 52428800, -- 50MB limit
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'pdfs';

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view PDFs if shared" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own PDFs" ON storage.objects;

-- Create a comprehensive policy for public read access to PDFs
CREATE POLICY "Public can read all PDFs"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'pdfs');

-- Keep the upload/update/delete policies for authenticated users only
-- These should already exist from previous migrations, but let's ensure they're correct

-- Recreate the upload policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can upload their own PDFs'
  ) THEN
    CREATE POLICY "Users can upload their own PDFs"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'pdfs' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Recreate the update policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can update their own PDFs'
  ) THEN
    CREATE POLICY "Users can update their own PDFs"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'pdfs' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Recreate the delete policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can delete their own PDFs'
  ) THEN
    CREATE POLICY "Users can delete their own PDFs"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'pdfs' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Add a comment explaining the CORS configuration
COMMENT ON TABLE storage.buckets IS 'Storage buckets. The pdfs bucket is public and should have CORS enabled in Supabase Dashboard: Settings > Storage > CORS Configuration';

