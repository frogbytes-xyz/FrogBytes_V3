-- Add library-specific fields to summaries table
-- This extends the sharing functionality with library features

-- Add title field (separate from lecture_name for user customization)
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add university field
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS university TEXT;

-- Add subject field  
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Add lecture_name field (original lecture title)
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS lecture_name TEXT;

-- Add reputation_score column for voting
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0 NOT NULL;

-- Create indexes for filtering and sorting in library
CREATE INDEX IF NOT EXISTS summaries_university_idx ON public.summaries(university) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_subject_idx ON public.summaries(subject) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_reputation_idx ON public.summaries(reputation_score DESC) WHERE is_public = true;

-- Add comments
COMMENT ON COLUMN public.summaries.title IS 'User-customizable title for the summary';
COMMENT ON COLUMN public.summaries.university IS 'University where the lecture was given';
COMMENT ON COLUMN public.summaries.subject IS 'Subject/course name';
COMMENT ON COLUMN public.summaries.lecture_name IS 'Original lecture title/topic';
COMMENT ON COLUMN public.summaries.reputation_score IS 'Cumulative vote score (upvotes - downvotes)';
