-- Create transcriptions table for storing transcribed content
-- This table stores the raw transcript and metadata from ElevenLabs

CREATE TABLE public.transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  language TEXT,
  duration_seconds NUMERIC,
  word_count INTEGER,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index on upload_id for fast lookups
CREATE INDEX transcriptions_upload_id_idx ON public.transcriptions(upload_id);

-- Create index on user_id for filtering
CREATE INDEX transcriptions_user_id_idx ON public.transcriptions(user_id);

-- Enable Row Level Security
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own transcriptions
CREATE POLICY "Users can view their own transcriptions"
  ON public.transcriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own transcriptions
CREATE POLICY "Users can insert their own transcriptions"
  ON public.transcriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own transcriptions
CREATE POLICY "Users can update their own transcriptions"
  ON public.transcriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to auto-update updated_at
CREATE TRIGGER handle_transcriptions_updated_at
  BEFORE UPDATE ON public.transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.transcriptions TO authenticated;
