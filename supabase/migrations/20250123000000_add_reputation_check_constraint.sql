-- Migration: Add check constraint to ensure reputation_score cannot go below 0
-- This enforces the minimum vote count requirement at the database level

-- Update any existing records with negative scores to 0 FIRST
UPDATE public.summaries
SET reputation_score = 0
WHERE reputation_score < 0;

-- Add check constraint to ensure reputation_score >= 0
ALTER TABLE public.summaries
ADD CONSTRAINT summaries_reputation_score_check
CHECK (reputation_score >= 0);

-- Update the trigger function to ensure it never sets reputation_score below 0
CREATE OR REPLACE FUNCTION update_summary_reputation_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate the reputation score for the affected summary
  -- Ensure the score never goes below 0
  UPDATE public.summaries
  SET reputation_score = GREATEST(0, (
    SELECT COALESCE(SUM(vote), 0)
    FROM public.votes
    WHERE summary_id = COALESCE(NEW.summary_id, OLD.summary_id)
  ))
  WHERE id = COALESCE(NEW.summary_id, OLD.summary_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON CONSTRAINT summaries_reputation_score_check ON public.summaries IS
  'Ensures reputation_score cannot go below 0';
