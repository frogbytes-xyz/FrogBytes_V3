-- Seed data for development and testing
-- This file populates the database with test data

-- Note: This seed file is for testing purposes only
-- In production, users will be created through the application

-- Insert test users (these will be created after auth.users are created manually)
-- Example test user data (passwords should be hashed via Supabase Auth UI or API)

-- Test User 1: student@university.edu
-- INSERT INTO public.users (id, email, full_name, university, reputation_score)
-- VALUES (
--   'user-uuid-1',
--   'student@university.edu',
--   'Test Student',
--   'Test University',
--   10
-- );

-- Test User 2: lecturer@university.edu
-- INSERT INTO public.users (id, email, full_name, university, reputation_score)
-- VALUES (
--   'user-uuid-2',
--   'lecturer@university.edu',
--   'Test Lecturer',
--   'Test University',
--   50
-- );

-- Note: Actual seeding should be done through the Supabase Auth API
-- to properly create auth.users entries first, which will then trigger
-- the handle_new_user() function to create corresponding public.users entries
