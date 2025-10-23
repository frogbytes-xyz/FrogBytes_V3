-- Fix user registration trigger to ensure proper user profile creation
-- This migration fixes the handle_new_user function to properly handle all fields

-- Drop the existing trigger and function to recreate them
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with proper error handling and all fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users with all available fields
  INSERT INTO public.users (id, email, full_name, university)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'university', NULL)
  );
  
  -- Also create a user_profiles entry for compatibility with invitation system
  -- This ensures both systems work together
  INSERT INTO public.user_profiles (id, email, full_name, tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'free'
  )
  ON CONFLICT (id) DO NOTHING; -- Don't fail if user_profiles already exists
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth.users insert
    RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
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
