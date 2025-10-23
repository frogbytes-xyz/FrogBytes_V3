-- Enhanced user registration with better error handling and dual table support
-- This migration ensures both users and user_profiles tables are properly populated

-- First, let's ensure the user_profiles table has the university field
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS university TEXT;

-- Drop and recreate the trigger with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create an enhanced function that handles both tables and errors gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
  user_university TEXT;
BEGIN
  -- Extract user metadata
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  user_university := COALESCE(NEW.raw_user_meta_data->>'university', NULL);
  
  -- Insert into public.users (main user table)
  BEGIN
    INSERT INTO public.users (id, email, full_name, university)
    VALUES (NEW.id, NEW.email, user_full_name, user_university);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to insert into public.users for %: %', NEW.email, SQLERRM;
  END;
  
  -- Insert into public.user_profiles (for invitation system compatibility)
  BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, university, tier)
    VALUES (NEW.id, NEW.email, user_full_name, user_university, 'free')
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      university = EXCLUDED.university;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to insert into public.user_profiles for %: %', NEW.email, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;
GRANT INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.user_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Create a function to manually sync existing users (for data recovery)
CREATE OR REPLACE FUNCTION public.sync_existing_users()
RETURNS INTEGER AS $$
DECLARE
  user_record RECORD;
  sync_count INTEGER := 0;
BEGIN
  -- Find auth.users that don't have corresponding public.users entries
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    -- Insert missing user record
    INSERT INTO public.users (id, email, full_name, university)
    VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', ''),
      COALESCE(user_record.raw_user_meta_data->>'university', NULL)
    );
    
    -- Also ensure user_profiles entry exists
    INSERT INTO public.user_profiles (id, email, full_name, university, tier)
    VALUES (
      user_record.id,
      user_record.email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', ''),
      COALESCE(user_record.raw_user_meta_data->>'university', NULL),
      'free'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      university = EXCLUDED.university;
    
    sync_count := sync_count + 1;
  END LOOP;
  
  RETURN sync_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
