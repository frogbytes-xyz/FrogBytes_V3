-- Fix UPDATE policy to allow orphaning published summaries
-- This enables users to set user_id to NULL for published documents

-- Drop the old restrictive UPDATE policy
DROP POLICY IF EXISTS "Users can update their own summaries" ON public.summaries;

-- Create new UPDATE policy that allows orphaning published summaries
CREATE POLICY "Users can update their own summaries"
  ON public.summaries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- Either keep the same user_id (normal update)
    auth.uid() = user_id
    OR 
    -- Or allow orphaning (setting user_id to NULL) for published documents
    (user_id IS NULL AND is_public = true)
  );

-- Add comment explaining the policy
COMMENT ON POLICY "Users can update their own summaries" ON public.summaries IS 
  'Allows users to update their summaries or orphan published ones by setting user_id to NULL';

