-- Production URL Configuration Migration
-- This migration helps configure Supabase for production URLs

-- Note: This migration is informational and requires manual configuration
-- in the Supabase Dashboard for production environments.

-- The following URLs should be configured in Supabase Dashboard > Authentication > URL Configuration:

-- Site URL (Primary):
-- https://your-production-domain.com

-- Redirect URLs (Additional):
-- https://your-production-domain.com/auth/callback
-- https://your-production-domain.com/auth/confirm
-- https://your-production-domain.com/auth/verify
-- https://your-production-domain.com/login
-- https://your-production-domain.com/register

-- For Vercel deployments, common patterns include:
-- https://your-app-name.vercel.app
-- https://your-custom-domain.com

-- Instructions for manual configuration:
-- 1. Go to Supabase Dashboard > Authentication > URL Configuration
-- 2. Update Site URL to your production domain
-- 3. Add all redirect URLs listed above
-- 4. Save the configuration
-- 5. Test email confirmation flow

-- This ensures email confirmation links redirect to the correct production domain
-- instead of localhost during development.
