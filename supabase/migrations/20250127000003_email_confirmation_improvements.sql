-- Email Confirmation Improvements Migration
-- This migration improves the email confirmation flow and user experience

-- Update the handle_new_user function to ensure proper user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.users table
  INSERT INTO public.users (id, email, full_name, university, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'university', NULL),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    university = EXCLUDED.university,
    updated_at = NOW();

  -- Also insert into public.user_profiles for compatibility
  INSERT INTO public.user_profiles (id, email, full_name, university, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'university', NULL),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    university = EXCLUDED.university,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to manually confirm user emails (for testing)
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the user to confirm their email
  UPDATE auth.users 
  SET email_confirmed_at = NOW(),
      updated_at = NOW()
  WHERE id = user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to resend confirmation email
CREATE OR REPLACE FUNCTION public.resend_confirmation_email(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
  user_record RECORD;
BEGIN
  -- Get the user from auth.users
  SELECT * INTO user_record 
  FROM auth.users 
  WHERE email = user_email;
  
  IF user_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- If user is already confirmed, return true
  IF user_record.email_confirmed_at IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  -- The actual resend will be handled by the application
  -- This function just validates the user exists
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);

-- Add comments for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Creates user profiles in both users and user_profiles tables when a new user signs up';
COMMENT ON FUNCTION public.confirm_user_email(TEXT) IS 'Manually confirms a user email for testing purposes';
COMMENT ON FUNCTION public.resend_confirmation_email(TEXT) IS 'Validates user exists for resending confirmation emails';
