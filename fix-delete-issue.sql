-- Combined fix for delete functionality issue
-- This script fixes two problems:
-- 1. Missing DELETE permission
-- 2. UPDATE policy preventing orphaning of published summaries

-- ========================================
-- FIX 1: Grant DELETE permission
-- ========================================
GRANT DELETE ON public.summaries TO authenticated;

-- ========================================
-- FIX 2: Update policy to allow orphaning
-- ========================================

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

-- Add helpful comments
COMMENT ON TABLE public.summaries IS 'Stores AI-generated lecture summaries. Users can delete their own summaries or orphan published ones by setting user_id to NULL.';
COMMENT ON POLICY "Users can update their own summaries" ON public.summaries IS 'Allows users to update their summaries or orphan published ones by setting user_id to NULL';


