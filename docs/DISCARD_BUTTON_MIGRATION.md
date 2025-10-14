# Discard Button Migration - Manual Application

The automated migration push encountered conflicts with previously applied migrations. Please apply the following SQL manually using the Supabase Dashboard SQL Editor:

## Steps to Apply:

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL below
4. Click "Run"

## SQL to Execute:

```sql
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
DROP POLICY IF EXISTS "Users can delete their own summaries" ON public.summaries;

CREATE POLICY "Users can delete their own summaries"
  ON public.summaries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment explaining the nullable user_id
COMMENT ON COLUMN public.summaries.user_id IS 'User who created the summary. NULL for orphaned published documents that were discarded by their creator.';

-- Add index to help with filtering orphaned summaries
CREATE INDEX IF NOT EXISTS summaries_orphaned_public_idx ON public.summaries(is_public) WHERE user_id IS NULL AND is_public = true;
```

## What This Does:

1. **Makes `user_id` nullable** - Allows summaries to exist without an owner
2. **Updates RLS policies** - Ensures users can still see their own summaries and that orphaned public summaries are visible in the library
3. **Adds delete policy** - Allows users to delete/discard their own summaries
4. **Adds index** - Optimizes queries for orphaned public summaries

## After Running the Migration:

The discard button functionality will work as follows:

- **Private documents (not published):** Completely deleted from the database
- **Published documents (public):** Removed from your dashboard but remain in the public library
  - The document's `user_id` is set to `null`
  - It stays visible in the public library as "Anonymous"
  - It no longer appears on your dashboard
  - You can no longer edit or manage it

## Testing:

1. Create a test document and publish it to the library
2. Click the delete/discard button (trash icon) on your dashboard
3. Confirm the action (note the message explains it will stay in the library)
4. Refresh your dashboard - the document should not reappear
5. Check the library page - the document should still be visible there
