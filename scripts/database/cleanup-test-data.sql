-- Cleanup Test Data Script
-- This script removes all user-generated data while preserving API keys
-- 
-- Usage:
--   1. Via Supabase SQL Editor: Copy and paste this script
--   2. Via psql: psql -d your_database -f cleanup-test-data.sql
--   3. Via Supabase CLI: supabase db execute < cleanup-test-data.sql
--
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

-- Disable RLS temporarily for cleanup (requires service role)
-- This allows us to delete all records regardless of RLS policies
SET session_replication_role = replica;

-- Start transaction
BEGIN;

-- Step 1: Delete feedback-related data
-- Delete feedback replies first (has FK to feedback)
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.feedback_replies;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % feedback replies', row_count;
END $$;

-- Delete feedback votes (has FK to feedback)
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.feedback_votes;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % feedback votes', row_count;
END $$;

-- Delete feedback
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.feedback;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % feedback items', row_count;
END $$;

-- Step 2: Delete collections and their items
-- Delete collection_items first (has FK to collections and summaries)
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.collection_items;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % collection items', row_count;
END $$;

-- Delete collections
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.collections;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % collections', row_count;
END $$;

-- Step 3: Delete votes on summaries
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.votes;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % votes', row_count;
END $$;

-- Step 4: Delete summaries
-- This will automatically trigger deletion of related PDFs via storage triggers
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.summaries;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % summaries', row_count;
END $$;

-- Step 5: Delete transcriptions
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.transcriptions;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transcriptions', row_count;
END $$;

-- Step 6: Delete uploads
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.uploads;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % uploads', row_count;
END $$;

-- Step 7: Delete user profiles (public.users)
-- Note: We need to delete auth.users first due to FK constraints
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM public.users;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % user profiles', row_count;
END $$;

-- Step 8: Delete auth users (requires service role)
-- This will delete the authentication records
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  DELETE FROM auth.users;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % auth users', row_count;
END $$;

-- Step 9: Verify API keys are still present
DO $$
DECLARE
  api_key_count INTEGER;
  scraped_key_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO api_key_count FROM public.api_keys;
  SELECT COUNT(*) INTO scraped_key_count FROM public.scraped_keys;
  
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'API keys preserved: % keys in api_keys table', api_key_count;
  RAISE NOTICE 'Scraped keys preserved: % keys in scraped_keys table', scraped_key_count;
  RAISE NOTICE '=============================================================================';
END $$;

-- Commit the transaction
COMMIT;

-- Re-enable RLS
RESET session_replication_role;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Database cleanup complete!';
  RAISE NOTICE 'Deleted: feedback, votes, collections, summaries, transcriptions, uploads, users';
  RAISE NOTICE 'Preserved: API keys (api_keys and scraped_keys tables)';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'IMPORTANT: Storage bucket cleanup';
  RAISE NOTICE 'You may need to manually clean storage buckets (uploads, pdfs)';
  RAISE NOTICE 'Go to Supabase Dashboard > Storage to delete files';
  RAISE NOTICE '=============================================================================';
END $$;


