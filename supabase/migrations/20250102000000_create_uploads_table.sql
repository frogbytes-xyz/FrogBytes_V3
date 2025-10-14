-- Create uploads table for tracking user file uploads
-- This table stores metadata about uploaded audio/video files

CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'transcribed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index on user_id for faster lookups
CREATE INDEX uploads_user_id_idx ON public.uploads(user_id);

-- Create index on status for filtering
CREATE INDEX uploads_status_idx ON public.uploads(status);

-- Create index on created_at for sorting
CREATE INDEX uploads_created_at_idx ON public.uploads(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own uploads
CREATE POLICY "Users can view their own uploads"
  ON public.uploads
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own uploads
CREATE POLICY "Users can insert their own uploads"
  ON public.uploads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own uploads
CREATE POLICY "Users can update their own uploads"
  ON public.uploads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own uploads
CREATE POLICY "Users can delete their own uploads"
  ON public.uploads
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to auto-update updated_at
CREATE TRIGGER handle_uploads_updated_at
  BEFORE UPDATE ON public.uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
