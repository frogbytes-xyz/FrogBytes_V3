import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

/**
 * Creates a Supabase client for use in Server Components and Server Actions
 * This client handles cookie management for authentication and respects RLS
 *
 * SECURITY NOTE: This client uses the anon key and respects RLS.
 * For admin operations, use createAdminClient() instead.
 */
export async function createClient(): Promise<ReturnType<typeof createServerClient<Database>>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch (error) {
          // Handle cookie setting errors in Server Components
          // This can happen when cookies are set in Server Components
          // The error is expected and can be safely ignored in some contexts
          if (process.env.NODE_ENV === 'development') {
            console.warn('Cookie setting error (expected in some contexts):', error)
          }
        }
      }
    }
  })
}

/**
 * Creates a Supabase admin client for server-side operations that need to bypass RLS
 *
 * WARNING: This client bypasses Row Level Security. Use with extreme caution.
 * Only use for admin operations, migrations, or system-level tasks.
 * Never expose this client to the frontend.
 */
export function createAdminClient(): ReturnType<typeof createServerClient<Database>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createServerClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // Admin client doesn't need cookie management
      }
    }
  })
}

/**
 * Type exports for convenience
 */
export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>
export type AdminSupabaseClient = ReturnType<typeof createAdminClient>
export type { Database }
