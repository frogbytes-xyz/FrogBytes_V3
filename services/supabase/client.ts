import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Creates a Supabase client for use in browser/client components
 * This client respects Row Level Security (RLS) policies
 *
 * SECURITY NOTE: This client uses the anon key and respects RLS.
 * Never use the service role key on the client side.
 */
export function createClient(): ReturnType<
  typeof createBrowserClient<Database>
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL environment variable is required. Please configure your database connection'
    )
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required. Please configure your database connection'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Singleton Supabase client instance
 * Use this for client-side operations
 */
export const supabase = createClient()

/**
 * Type exports for convenience
 */
export type SupabaseClient = ReturnType<typeof createClient>
export type { Database }
