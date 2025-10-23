-- Final comprehensive fix for user registration issues
-- This migration ensures proper user profile creation and handles email confirmation

-- Step 1: Ensure both tables exist and have the required fields
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS university TEXT;

-- Step 2: Create a comprehensive user creation function
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

-- Step 3: Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Create a function to sync existing users
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

-- Step 5: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;
GRANT INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.user_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Step 6: Create a function to manually confirm emails (for testing)
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Find the user by email
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the user to confirm email
  UPDATE auth.users 
  SET email_confirmed_at = NOW()
  WHERE id = user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
