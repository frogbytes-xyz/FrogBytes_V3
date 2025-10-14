-- Cleanup Test Data Migration
-- This migration removes all user-generated data while preserving API keys
-- Execute this to clean up test data from the database

-- =============================================================================
-- IMPORTANT: This script will delete ALL user data including:
-- - Feedback (feedback, feedback_votes, feedback_replies)
-- - Collection items and collections
-- - Votes
-- - Summaries (and their PDFs)
-- - Transcriptions
-- - Uploads
-- - User profiles
-- - Auth users
-- 
-- PRESERVED: API keys (api_keys, scraped_keys tables)
-- =============================================================================

BEGIN;

-- Step 1: Delete feedback-related data
-- Delete feedback replies first (has FK to feedback)
DELETE FROM public.feedback_replies;
RAISE NOTICE 'Deleted all feedback replies';

-- Delete feedback votes (has FK to feedback)
DELETE FROM public.feedback_votes;
RAISE NOTICE 'Deleted all feedback votes';

-- Delete feedback
DELETE FROM public.feedback;
RAISE NOTICE 'Deleted all feedback';

-- Step 2: Delete collections and their items
-- Delete collection_items first (has FK to collections and summaries)
DELETE FROM public.collection_items;
RAISE NOTICE 'Deleted all collection items';

-- Delete collections
DELETE FROM public.collections;
RAISE NOTICE 'Deleted all collections';

-- Step 3: Delete votes on summaries
DELETE FROM public.votes;
RAISE NOTICE 'Deleted all votes';

-- Step 4: Delete summaries
-- This will automatically trigger deletion of related PDFs via storage triggers
DELETE FROM public.summaries;
RAISE NOTICE 'Deleted all summaries';

-- Step 5: Delete transcriptions
DELETE FROM public.transcriptions;
RAISE NOTICE 'Deleted all transcriptions';

-- Step 6: Delete uploads
-- This should cascade through transcriptions and summaries if not already deleted
DELETE FROM public.uploads;
RAISE NOTICE 'Deleted all uploads';

-- Step 7: Delete user profiles (public.users)
-- This will cascade to all related user data
DELETE FROM public.users;
RAISE NOTICE 'Deleted all user profiles';

-- Step 8: Delete auth users (requires service role)
-- This will delete the authentication records
DELETE FROM auth.users;
RAISE NOTICE 'Deleted all auth users';

-- Step 9: Verify API keys are still present
DO $$
DECLARE
  api_key_count INTEGER;
  scraped_key_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO api_key_count FROM public.api_keys;
  SELECT COUNT(*) INTO scraped_key_count FROM public.scraped_keys;
  
  RAISE NOTICE 'API keys preserved: % keys in api_keys table', api_key_count;
  RAISE NOTICE 'Scraped keys preserved: % keys in scraped_keys table', scraped_key_count;
END $$;

-- Step 10: Reset sequences if any exist
-- This ensures new records start with clean IDs

-- Optional: Clean up storage buckets (requires manual action or storage API)
-- Note: This migration doesn't delete files from storage buckets
-- You may need to manually clean up the following buckets:
-- - uploads
-- - pdfs
-- To clean storage buckets, use Supabase dashboard or API

COMMIT;

-- Summary of what was cleaned:
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'Database cleanup complete!';
RAISE NOTICE 'Deleted: feedback, votes, collections, summaries, transcriptions, uploads, users';
RAISE NOTICE 'Preserved: API keys (api_keys and scraped_keys tables)';
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'IMPORTANT: You may need to manually clean storage buckets (uploads, pdfs)';
RAISE NOTICE 'Go to Supabase Dashboard > Storage to delete files';
RAISE NOTICE '=============================================================================';


