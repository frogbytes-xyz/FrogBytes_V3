# Admin Dashboard Security Setup Guide

## Overview

This guide explains how to set up and configure the new role-based admin security system implemented for the FrogBytes admin dashboard.

## What's Been Implemented

### Security Architecture

The admin system now uses a **multi-layered defense-in-depth approach**:

1. **Database Layer**: User roles stored in database with RLS policies
2. **Middleware Layer**: All admin routes require authentication
3. **Route Handler Layer**: `requireAdmin()` wrapper verifies admin role
4. **Audit Layer**: All admin actions logged to `admin_audit_logs` table

### Files Created/Modified

**New Files:**
- `supabase/migrations/20250202000000_add_user_roles_and_audit_logging.sql` - Database migration
- `lib/auth/admin-auth.ts` - Admin authentication utilities (410 lines)
- `components/auth/AdminGuard.tsx` - Page-level access control component
- `hooks/useAdminAuth.ts` - Client-side admin auth hook

**Modified Files:**
- `middleware.ts` - Removed admin route exclusion
- `app/admin/dashboard/page.tsx` - Wrapped with AdminGuard
- `app/admin/api-keys/page.tsx` - Wrapped with AdminGuard
- All 19 admin API routes in `app/api/admin/**` - Secured with requireAdmin()

## Step-by-Step Setup

### Step 1: Apply Database Migration

The database migration adds user roles and audit logging tables to your Supabase database.

**Option A: Using Supabase CLI (Recommended)**

```bash
# Navigate to project directory
cd /path/to/FrogBytes_V3

# Apply the migration
supabase db push
```

**Option B: Via Supabase Dashboard**

1. Go to https://supabase.com/dashboard
2. Select your FrogBytes project
3. Navigate to SQL Editor
4. Copy the contents of `supabase/migrations/20250202000000_add_user_roles_and_audit_logging.sql`
5. Paste into SQL Editor and run

**What the migration does:**
- Adds `role` column to `users` table (values: `user`, `admin`, `super_admin`)
- Creates `admin_audit_logs` table for compliance tracking
- Implements Row Level Security (RLS) policies
- Creates helper functions: `is_admin()`, `is_super_admin()`, `get_user_role()`

### Step 2: Create Your First Admin User

After applying the migration, you need to designate at least one user as an admin.

**SQL Command:**

```sql
-- Replace with your actual email address
UPDATE users
SET role = 'super_admin'
WHERE email = 'your-email@example.com';
```

**Where to run this:**
- **Supabase Dashboard**: SQL Editor tab
- **Supabase CLI**: `supabase db execute "UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';"`

**Role Types:**
- `user` - Default role, no admin access
- `admin` - Can access admin dashboard and perform most admin operations
- `super_admin` - Full admin access, can manage other admins

### Step 3: Test Admin Access

1. **Log out** of FrogBytes (to refresh your session)
2. **Log back in** with your admin email
3. Navigate to `/admin/dashboard`
4. You should see the admin dashboard

**Troubleshooting:**
- If redirected to home page: Your role wasn't updated (check Step 2)
- If see "loading forever": Check browser console for errors
- If 403 error: Clear cookies and log in again

### Step 4: Verify Security (Optional but Recommended)

Test that non-admin users are properly blocked:

1. Create or use a test user account (non-admin)
2. Try to access `/admin/dashboard`
3. Should be redirected to home page with "Access Denied" message
4. Try to call `/api/admin/users` directly
5. Should receive 401/403 error

## Admin User Management

### Adding More Admins

```sql
-- Make a user an admin
UPDATE users
SET role = 'admin'
WHERE email = 'new-admin@example.com';

-- Make a user a super admin
UPDATE users
SET role = 'super_admin'
WHERE email = 'super-admin@example.com';
```

### Removing Admin Access

```sql
-- Demote admin to regular user
UPDATE users
SET role = 'user'
WHERE email = 'former-admin@example.com';
```

### Listing All Admins

```sql
-- See all current admins
SELECT id, email, role, created_at
FROM users
WHERE role IN ('admin', 'super_admin')
ORDER BY role DESC, created_at ASC;
```

## Audit Logging

All admin actions are automatically logged to the `admin_audit_logs` table.

### View Recent Admin Actions

```sql
-- Last 50 admin actions
SELECT
  a.created_at,
  u.email as admin_email,
  a.action,
  a.resource_type,
  a.resource_id,
  a.details,
  a.ip_address
FROM admin_audit_logs a
JOIN users u ON u.id = a.admin_id
ORDER BY a.created_at DESC
LIMIT 50;
```

### View Actions by Specific Admin

```sql
-- Actions by specific admin email
SELECT
  created_at,
  action,
  resource_type,
  details
FROM admin_audit_logs
WHERE admin_id = (SELECT id FROM users WHERE email = 'admin@example.com')
ORDER BY created_at DESC;
```

### Monitor Security Events

```sql
-- All user role changes (if logged)
SELECT * FROM admin_audit_logs
WHERE action = 'update_user_role'
ORDER BY created_at DESC;

-- All API key deletions
SELECT * FROM admin_audit_logs
WHERE action = 'delete_api_key'
ORDER BY created_at DESC;
```

## API Integration

### Frontend Usage (Admin Dashboard)

The admin dashboard pages automatically use `AdminGuard`:

```typescript
// Example: app/admin/dashboard/page.tsx
import { AdminGuard } from '@/components/auth/AdminGuard'

export default function AdminDashboard() {
  return (
    <AdminGuard>
      {/* Your admin content here */}
    </AdminGuard>
  )
}
```

### Custom Admin Components

Use the `useAdminAuth` hook in client components:

```typescript
'use client'

import { useAdminAuth } from '@/hooks/useAdminAuth'

export function MyAdminComponent() {
  const { user, isAdmin, isSuperAdmin, loading } = useAdminAuth()

  if (loading) return <div>Loading...</div>
  if (!isAdmin) return <div>Access Denied</div>

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      {isSuperAdmin && <p>You have super admin privileges</p>}
    </div>
  )
}
```

### API Route Protection

All admin API routes are automatically protected with `requireAdmin()`:

```typescript
// Example: app/api/admin/your-route/route.ts
import { requireAdmin, logAdminAction, createAuditLogEntry } from '@/lib/auth/admin-auth'

export const GET = requireAdmin(async (request, user) => {
  // user is guaranteed to be an admin here

  // Log the action
  await logAdminAction(
    createAuditLogEntry(request, user, 'your_action', 'resource_type')
  )

  return NextResponse.json({ data: 'your data' })
})
```

## Security Best Practices

### 1. Limit Super Admins

Only grant `super_admin` to 1-2 trusted individuals. Most admins should have the `admin` role.

### 2. Regular Audit Reviews

Review audit logs monthly:

```sql
-- Actions in last 30 days
SELECT
  action,
  COUNT(*) as count
FROM admin_audit_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY action
ORDER BY count DESC;
```

### 3. IP Allowlisting (Optional)

Consider restricting admin access to specific IP addresses:

```typescript
// In lib/auth/admin-auth.ts
const ALLOWED_IPS = ['1.2.3.4', '5.6.7.8']

export async function verifyAdminAccess(request: NextRequest): Promise<boolean> {
  const user = await getAdminUser(request)
  if (!isAdmin(user)) return false

  const clientIp = getClientIp(request)
  if (ALLOWED_IPS.length > 0 && clientIp && !ALLOWED_IPS.includes(clientIp)) {
    logger.warn('Admin access denied - IP not allowed', { ip: clientIp })
    return false
  }

  return true
}
```

### 4. Session Timeout

Configure shorter session timeouts for admin users in Supabase Dashboard:
- Navigate to Authentication → Settings
- Adjust JWT expiry to 1-4 hours for admins

### 5. Monitor Failed Access Attempts

Set up alerts for failed admin access attempts:

```sql
-- Check for repeated 403s in your application logs
-- Set up database trigger or external monitoring
```

## Troubleshooting

### "Unauthorized" error after migration

**Problem**: Getting 401/403 errors even with correct admin role.

**Solutions**:
1. Clear browser cookies
2. Log out and log back in
3. Verify role in database: `SELECT email, role FROM users WHERE email = 'your@email.com'`

### Admin page shows loading spinner forever

**Problem**: AdminGuard stuck in loading state.

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify Supabase environment variables are set
3. Ensure database migration was applied successfully

### Cannot see admin dashboard after role update

**Problem**: Updated role in database but still no access.

**Solutions**:
1. **Must log out and log back in** - role is cached in JWT token
2. Or wait for token to expire (default: 1 hour)
3. Force token refresh by clearing cookies

### Audit logs not appearing

**Problem**: Admin actions not being logged.

**Solutions**:
1. Check `SUPABASE_SERVICE_ROLE_KEY` is set in environment
2. Verify RLS policies on `admin_audit_logs` table
3. Check application logs for audit logging errors

## Environment Variables Required

Ensure these are set in your `.env.local` file:

```bash
# Required for admin client operations
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional - remove if migrated to role-based auth
# ADMIN_API_KEY=legacy_api_key  # Can be removed after migration
```

## Migration from Old System

If you were using the old `ADMIN_API_KEY` system:

1. Apply the database migration (Step 1 above)
2. Create admin users (Step 2 above)
3. Deploy the new code
4. Test admin access with role-based auth
5. Remove `ADMIN_API_KEY` from environment variables
6. Remove any frontend code using `NEXT_PUBLIC_ADMIN_API_KEY`

## Support

For issues or questions:
1. Check this setup guide
2. Review audit logs for security events
3. Check application logs for errors
4. Verify environment variables
5. Test with a clean browser session (incognito mode)

---

**Security Note**: This implementation follows enterprise security best practices with defense-in-depth, comprehensive audit logging, and role-based access control. All admin actions are tracked and can be reviewed for compliance.
