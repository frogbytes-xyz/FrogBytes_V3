-- Add user roles and admin audit logging system
-- Migration: 20250202000000_add_user_roles_and_audit_logging.sql

-- Step 1: Add role column to users table
-- Roles: 'user' (default), 'admin', 'super_admin'
ALTER TABLE public.users
ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
CHECK (role IN ('user', 'admin', 'super_admin'));

-- Create index on role for faster admin queries
CREATE INDEX users_role_idx ON public.users(role);

-- Step 2: Create admin audit log table
-- Tracks all admin actions for security and compliance
CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for audit log queries
CREATE INDEX admin_audit_logs_admin_id_idx ON public.admin_audit_logs(admin_id);
CREATE INDEX admin_audit_logs_created_at_idx ON public.admin_audit_logs(created_at DESC);
CREATE INDEX admin_audit_logs_action_idx ON public.admin_audit_logs(action);
CREATE INDEX admin_audit_logs_resource_type_idx ON public.admin_audit_logs(resource_type);

-- Enable Row Level Security on audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 3: RLS Policies for audit logs

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Only the system (service role) can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed (audit logs are immutable)
-- This ensures audit trail integrity

-- Step 4: Update users table RLS policies for admin access

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view all user profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Recreate with admin support

-- All authenticated users can view user profiles
CREATE POLICY "Authenticated users can view user profiles"
  ON public.users
  FOR SELECT
  USING (true);

-- Users can update their own profile (excluding role)
CREATE POLICY "Users can update own profile except role"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- User cannot change their own role
      (SELECT role FROM public.users WHERE id = auth.uid()) = NEW.role
      OR
      -- Unless they are a super_admin
      (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin'
    )
  );

-- Only super_admins can update any user (including roles)
CREATE POLICY "Super admins can update any user"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Step 5: Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.users
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Grant permissions
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT INSERT ON public.admin_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role TO authenticated;

-- Step 7: Add comment documentation
COMMENT ON COLUMN public.users.role IS 'User role: user (default), admin (can access admin dashboard), super_admin (can manage other admins)';
COMMENT ON TABLE public.admin_audit_logs IS 'Immutable audit log of all admin actions for security and compliance';
COMMENT ON FUNCTION public.is_admin IS 'Returns true if the specified user (or current user) has admin or super_admin role';
COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if the specified user (or current user) has super_admin role';
COMMENT ON FUNCTION public.get_user_role IS 'Returns the role of the specified user (or current user)';
