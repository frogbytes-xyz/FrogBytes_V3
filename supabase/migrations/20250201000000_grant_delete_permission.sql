-- Fix missing DELETE permission on summaries table
-- This was preventing users from actually deleting their summaries

-- Grant DELETE permission to authenticated users
GRANT DELETE ON public.summaries TO authenticated;

-- Add comment explaining the fix
COMMENT ON TABLE public.summaries IS 'Stores AI-generated lecture summaries. Users can delete their own summaries or orphan published ones by setting user_id to NULL.';


