-- Migration: Add trigger to automatically update reputation_score in summaries table
-- when votes are added, updated, or deleted
--
-- This ensures that the reputation_score column always reflects the actual vote count
-- without requiring manual updates from the application layer.

-- Function to recalculate and update reputation_score for a summary
CREATE OR REPLACE FUNCTION update_summary_reputation_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate the reputation score for the affected summary
  UPDATE public.summaries
  SET reputation_score = (
    SELECT COALESCE(SUM(vote), 0)
    FROM public.votes
    WHERE summary_id = COALESCE(NEW.summary_id, OLD.summary_id)
  )
  WHERE id = COALESCE(NEW.summary_id, OLD.summary_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS vote_insert_update_reputation ON public.votes;
DROP TRIGGER IF EXISTS vote_update_update_reputation ON public.votes;
DROP TRIGGER IF EXISTS vote_delete_update_reputation ON public.votes;

-- Trigger for INSERT: Update reputation when a new vote is added
CREATE TRIGGER vote_insert_update_reputation
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_reputation_score();

-- Trigger for UPDATE: Update reputation when a vote is changed
CREATE TRIGGER vote_update_update_reputation
  AFTER UPDATE ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_reputation_score();

-- Trigger for DELETE: Update reputation when a vote is removed
CREATE TRIGGER vote_delete_update_reputation
  AFTER DELETE ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_reputation_score();

-- Add comment
COMMENT ON FUNCTION update_summary_reputation_score() IS 
  'Automatically updates reputation_score in summaries table when votes are modified';

