-- ====================================================================
-- CRITICAL FIX: Allow orphaning published summaries
-- Run this SQL in your Supabase Dashboard SQL Editor
-- ====================================================================

-- Step 1: Make user_id nullable (if not already)
DO $$ 
BEGIN
  ALTER TABLE public.summaries ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'user_id is already nullable or error: %', SQLERRM;
END $$;

-- Step 2: Fix the UPDATE policy to allow orphaning
DROP POLICY IF EXISTS "Users can update their own summaries" ON public.summaries;

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

-- Step 3: Ensure DELETE permission is granted
GRANT DELETE ON public.summaries TO authenticated;

-- Step 4: Create the orphaning function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.orphan_published_summary(summary_id_param UUID)
RETURNS JSON AS $$
DECLARE
  summary_record RECORD;
  result JSON;
BEGIN
  -- First, verify the summary exists and belongs to the calling user
  SELECT id, user_id, is_public, title
  INTO summary_record
  FROM public.summaries
  WHERE id = summary_id_param;

  -- Check if summary exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Summary not found'
    );
  END IF;

  -- Verify the user owns this summary
  IF summary_record.user_id != auth.uid() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You do not have permission to modify this summary'
    );
  END IF;

  -- Verify the summary is public
  IF summary_record.is_public != true THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only published summaries can be orphaned'
    );
  END IF;

  -- Perform the orphaning: set user_id to NULL while keeping is_public = true
  UPDATE public.summaries
  SET user_id = NULL
  WHERE id = summary_id_param;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Summary successfully orphaned and removed from your dashboard'
  );

EXCEPTION WHEN OTHERS THEN
  -- Handle any unexpected errors
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.orphan_published_summary(UUID) TO authenticated;

-- Step 5: Update SELECT policy to allow viewing orphaned summaries (if not already)
DROP POLICY IF EXISTS "Users can view their own summaries" ON public.summaries;
DROP POLICY IF EXISTS "Users can view their own summaries or orphaned public ones" ON public.summaries;

CREATE POLICY "Users can view their own summaries or orphaned public ones"
  ON public.summaries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND is_public = true)
  );

-- Step 6: Ensure public summaries are viewable by everyone
DROP POLICY IF EXISTS "Anyone can view public summaries" ON public.summaries;

CREATE POLICY "Anyone can view public summaries"
  ON public.summaries
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Add helpful comments
COMMENT ON FUNCTION public.orphan_published_summary(UUID) IS
  'Safely orphans a published summary by setting user_id to NULL. Only the owner can orphan their own published summaries. Uses SECURITY DEFINER to bypass RLS restrictions.';

COMMENT ON POLICY "Users can update their own summaries" ON public.summaries IS 
  'Allows users to update their summaries or orphan published ones by setting user_id to NULL';

SELECT 'Migration completed successfully!' as status;

