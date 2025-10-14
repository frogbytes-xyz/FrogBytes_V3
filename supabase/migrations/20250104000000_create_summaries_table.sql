-- Create summaries table for storing AI-generated summaries
-- This table stores the LaTeX-formatted summaries and metadata

CREATE TABLE public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id UUID NOT NULL REFERENCES public.transcriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latex_content TEXT NOT NULL,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('compact', 'detailed', 'expanded')),
  chunk_count INTEGER NOT NULL DEFAULT 1,
  total_tokens INTEGER,
  processing_time_seconds NUMERIC,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create index on transcription_id for fast lookups
CREATE INDEX summaries_transcription_id_idx ON public.summaries(transcription_id);

-- Create index on user_id for filtering
CREATE INDEX summaries_user_id_idx ON public.summaries(user_id);

-- Create index on summary_type for filtering
CREATE INDEX summaries_summary_type_idx ON public.summaries(summary_type);

-- Enable Row Level Security
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own summaries
CREATE POLICY "Users can view their own summaries"
  ON public.summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own summaries
CREATE POLICY "Users can insert their own summaries"
  ON public.summaries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own summaries
CREATE POLICY "Users can update their own summaries"
  ON public.summaries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to auto-update updated_at
CREATE TRIGGER handle_summaries_updated_at
  BEFORE UPDATE ON public.summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.summaries TO authenticated;
