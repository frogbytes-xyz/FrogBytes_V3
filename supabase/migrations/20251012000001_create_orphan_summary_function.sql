-- Create a server-side function to safely orphan published summaries
-- This function bypasses RLS with SECURITY DEFINER while maintaining security checks

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.orphan_published_summary(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.orphan_published_summary(UUID) IS
  'Safely orphans a published summary by setting user_id to NULL. Only the owner can orphan their own published summaries. Uses SECURITY DEFINER to bypass RLS restrictions.';

