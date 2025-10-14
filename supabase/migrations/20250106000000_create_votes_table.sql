-- Create votes table for upvote/downvote functionality
-- Users can vote on shared summaries to rank quality

CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  summary_id UUID NOT NULL REFERENCES public.summaries(id) ON DELETE CASCADE,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)), -- -1 for downvote, 1 for upvote
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Ensure one vote per user per summary
  UNIQUE(user_id, summary_id)
);

-- Create index on summary_id for vote count aggregation
CREATE INDEX votes_summary_id_idx ON public.votes(summary_id);

-- Create index on user_id for user's voting history
CREATE INDEX votes_user_id_idx ON public.votes(user_id);

-- Create index on vote value for filtering
CREATE INDEX votes_vote_idx ON public.votes(vote);

-- Enable Row Level Security
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can view all votes (for aggregation)
CREATE POLICY "Authenticated users can view votes"
  ON public.votes
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Users can insert their own votes
CREATE POLICY "Users can insert their own votes"
  ON public.votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own votes
CREATE POLICY "Users can update their own votes"
  ON public.votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON public.votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to auto-update updated_at
CREATE TRIGGER handle_votes_updated_at
  BEFORE UPDATE ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;

-- Create view for vote counts per summary
CREATE OR REPLACE VIEW public.summary_votes AS
SELECT 
  summary_id,
  COUNT(*) FILTER (WHERE vote = 1) AS upvotes,
  COUNT(*) FILTER (WHERE vote = -1) AS downvotes,
  COUNT(*) FILTER (WHERE vote = 1) - COUNT(*) FILTER (WHERE vote = -1) AS net_votes
FROM public.votes
GROUP BY summary_id;

-- Grant SELECT on view
GRANT SELECT ON public.summary_votes TO authenticated;

-- Add comment describing the table
COMMENT ON TABLE public.votes IS 'User votes (upvote/downvote) on shared summaries for quality ranking';
COMMENT ON COLUMN public.votes.vote IS 'Vote value: 1 for upvote, -1 for downvote';
COMMENT ON VIEW public.summary_votes IS 'Aggregated vote counts per summary';
