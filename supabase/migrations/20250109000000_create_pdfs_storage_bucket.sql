-- Create storage bucket for PDFs
-- This bucket will store compiled PDF files from summaries

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects for the pdfs bucket
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdfs' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public access for viewing PDFs (for sharing functionality)
CREATE POLICY "Public can view PDFs if shared"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdfs');
