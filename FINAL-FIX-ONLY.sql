-- ====================================================================
-- ORPHAN SUMMARY FIX - Safe to run, won't create duplicates
-- This only fixes the RLS policies and creates the orphaning function
-- ====================================================================

-- Step 1: Make user_id nullable (safe - won't error if already nullable)
DO $$ 
BEGIN
  ALTER TABLE public.summaries ALTER COLUMN user_id DROP NOT NULL;
  RAISE NOTICE 'user_id is now nullable';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'user_id is already nullable: %', SQLERRM;
END $$;

-- Step 2: Drop and recreate the UPDATE policy
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

COMMENT ON POLICY "Users can update their own summaries" ON public.summaries IS 
  'Allows users to update their summaries or orphan published ones by setting user_id to NULL';

-- Step 3: Ensure DELETE permission is granted
DO $$
BEGIN
  GRANT DELETE ON public.summaries TO authenticated;
  RAISE NOTICE 'DELETE permission granted';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Permission already granted or error: %', SQLERRM;
END $$;

-- Step 4: Create/Replace the orphaning function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.orphan_published_summary(summary_id_param UUID)
RETURNS JSON AS $$
DECLARE
  summary_record RECORD;
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

GRANT EXECUTE ON FUNCTION public.orphan_published_summary(UUID) TO authenticated;

COMMENT ON FUNCTION public.orphan_published_summary(UUID) IS
  'Safely orphans a published summary by setting user_id to NULL. Uses SECURITY DEFINER to bypass RLS.';

-- Step 5: Update SELECT policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own summaries" ON public.summaries;
DROP POLICY IF EXISTS "Users can view their own summaries or orphaned public ones" ON public.summaries;

CREATE POLICY "Users can view their own summaries or orphaned public ones"
  ON public.summaries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND is_public = true)
  );

-- Step 6: Ensure public summaries policy exists
DROP POLICY IF EXISTS "Anyone can view public summaries" ON public.summaries;

CREATE POLICY "Anyone can view public summaries"
  ON public.summaries
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Step 7: Ensure DELETE policy exists
DROP POLICY IF EXISTS "Users can delete their own summaries" ON public.summaries;

CREATE POLICY "Users can delete their own summaries"
  ON public.summaries
  FOR DELETE
  USING (auth.uid() = user_id);

-- All done!
SELECT 
  '✅ Migration completed successfully!' as status,
  'You can now remove public summaries from your dashboard!' as message;

