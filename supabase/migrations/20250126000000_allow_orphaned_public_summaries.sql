-- Allow summaries to exist without an owner (for discarded published documents)
-- This enables users to remove published documents from their dashboard
-- while keeping them available in the public library

-- Make user_id nullable to support orphaned public summaries
ALTER TABLE public.summaries
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policy to allow users to see summaries they own OR that are orphaned and public
DROP POLICY IF EXISTS "Users can view their own summaries" ON public.summaries;

CREATE POLICY "Users can view their own summaries or orphaned public ones"
  ON public.summaries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND is_public = true)
  );

-- Allow users to delete their own summaries
CREATE POLICY "Users can delete their own summaries"
  ON public.summaries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment explaining the nullable user_id
COMMENT ON COLUMN public.summaries.user_id IS 'User who created the summary. NULL for orphaned published documents that were discarded by their creator.';

-- Add index to help with filtering orphaned summaries
CREATE INDEX IF NOT EXISTS summaries_orphaned_public_idx ON public.summaries(is_public) WHERE user_id IS NULL AND is_public = true;
