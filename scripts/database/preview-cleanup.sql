-- Preview Test Data Cleanup
-- This script shows what will be deleted without actually deleting anything
-- Run this first to verify what will be removed
--
-- Usage:
--   1. Via Supabase SQL Editor: Copy and paste this script
--   2. Via psql: psql -d your_database -f preview-cleanup.sql
--
-- =============================================================================

DO $$
DECLARE
  feedback_replies_count INTEGER;
  feedback_votes_count INTEGER;
  feedback_count INTEGER;
  collection_items_count INTEGER;
  collections_count INTEGER;
  votes_count INTEGER;
  summaries_count INTEGER;
  transcriptions_count INTEGER;
  uploads_count INTEGER;
  users_count INTEGER;
  auth_users_count INTEGER;
  api_keys_count INTEGER;
  scraped_keys_count INTEGER;
BEGIN
  -- Count records in each table
  SELECT COUNT(*) INTO feedback_replies_count FROM public.feedback_replies;
  SELECT COUNT(*) INTO feedback_votes_count FROM public.feedback_votes;
  SELECT COUNT(*) INTO feedback_count FROM public.feedback;
  SELECT COUNT(*) INTO collection_items_count FROM public.collection_items;
  SELECT COUNT(*) INTO collections_count FROM public.collections;
  SELECT COUNT(*) INTO votes_count FROM public.votes;
  SELECT COUNT(*) INTO summaries_count FROM public.summaries;
  SELECT COUNT(*) INTO transcriptions_count FROM public.transcriptions;
  SELECT COUNT(*) INTO uploads_count FROM public.uploads;
  SELECT COUNT(*) INTO users_count FROM public.users;
  SELECT COUNT(*) INTO auth_users_count FROM auth.users;
  SELECT COUNT(*) INTO api_keys_count FROM public.api_keys;
  SELECT COUNT(*) INTO scraped_keys_count FROM public.scraped_keys;
  
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'CLEANUP PREVIEW - Current Database State';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Records that WILL BE DELETED:';
  RAISE NOTICE '  - Feedback replies: %', feedback_replies_count;
  RAISE NOTICE '  - Feedback votes: %', feedback_votes_count;
  RAISE NOTICE '  - Feedback items: %', feedback_count;
  RAISE NOTICE '  - Collection items: %', collection_items_count;
  RAISE NOTICE '  - Collections: %', collections_count;
  RAISE NOTICE '  - Votes: %', votes_count;
  RAISE NOTICE '  - Summaries: %', summaries_count;
  RAISE NOTICE '  - Transcriptions: %', transcriptions_count;
  RAISE NOTICE '  - Uploads: %', uploads_count;
  RAISE NOTICE '  - User profiles: %', users_count;
  RAISE NOTICE '  - Auth users: %', auth_users_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Records that WILL BE PRESERVED:';
  RAISE NOTICE '  - API keys: %', api_keys_count;
  RAISE NOTICE '  - Scraped keys: %', scraped_keys_count;
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Total user data records to delete: %', 
    feedback_replies_count + feedback_votes_count + feedback_count + 
    collection_items_count + collections_count + votes_count + 
    summaries_count + transcriptions_count + uploads_count + 
    users_count + auth_users_count;
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'To proceed with cleanup, run: cleanup-test-data.sql';
  RAISE NOTICE '';
END $$;


