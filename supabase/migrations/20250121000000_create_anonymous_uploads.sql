-- Create anonymous_uploads table for temporary file storage
CREATE TABLE IF NOT EXISTS anonymous_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  claimed_by UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for cleanup of expired uploads
CREATE INDEX IF NOT EXISTS idx_anonymous_uploads_expires_at ON anonymous_uploads(expires_at);

-- Create index for finding uploads by ID
CREATE INDEX IF NOT EXISTS idx_anonymous_uploads_id ON anonymous_uploads(id);

-- Enable RLS
ALTER TABLE anonymous_uploads ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to insert anonymous uploads
CREATE POLICY "Anyone can create anonymous uploads" ON anonymous_uploads
  FOR INSERT WITH CHECK (true);

-- Policy to allow anyone to read their own anonymous uploads (by ID)
CREATE POLICY "Anyone can read anonymous uploads by ID" ON anonymous_uploads
  FOR SELECT USING (true);

-- Policy to allow authenticated users to update (claim) anonymous uploads
CREATE POLICY "Authenticated users can claim anonymous uploads" ON anonymous_uploads
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Function to clean up expired anonymous uploads
CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_uploads()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM anonymous_uploads
  WHERE expires_at < NOW() AND claimed_by IS NULL;
END;
$$;