import { logger } from '@/lib/utils/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  requireAdmin,
  logAdminAction,
  createAuditLogEntry
} from '@/lib/auth/admin-auth'

/**
 * Admin API: Get all API keys
 * Protected endpoint for viewing API key pool
 *
 * Security: Requires admin role
 */

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/admin/api-keys
 *
 * Retrieve all API keys from the pool
 *
 * Returns:
 * - 200: Array of API keys with metadata
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const supabase = getSupabaseClient()

    // Fetch all API keys
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching API keys', { error })
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      )
    }

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(
        request,
        user,
        'view_api_keys',
        'api_keys',
        undefined,
        { count: keys?.length || 0 }
      )
    )

    return NextResponse.json({
      keys: keys || [],
      count: keys?.length || 0,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Admin API error', { error })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})

/**
 * POST /api/admin/api-keys
 *
 * Add a new API key manually to the pool
 *
 * Request Body:
 * - api_key: The API key value
 * - source: Source of the key (e.g., "manual", "scraped")
 * - source_url: Optional URL where key was found
 *
 * Returns:
 * - 200: API key added successfully
 * - 400: Missing required fields
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 409: API key already exists
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { api_key, source, source_url } = body

    if (!api_key || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: api_key, source' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        api_key,
        source,
        source_url,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'API key already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(request, user, 'add_api_key', 'api_keys', data.id, {
        source,
        source_url
      })
    )

    return NextResponse.json({
      success: true,
      key: data
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Add API key error', { error })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})

/**
 * DELETE /api/admin/api-keys
 *
 * Delete an API key from the pool
 *
 * Query Parameters:
 * - id: The ID of the API key to delete
 *
 * Returns:
 * - 200: API key deleted successfully
 * - 400: Missing key ID
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const DELETE = requireAdmin(async (request: NextRequest, user) => {
  try {
    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return NextResponse.json({ error: 'Missing key ID' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    const { error } = await supabase.from('api_keys').delete().eq('id', keyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(request, user, 'delete_api_key', 'api_keys', keyId)
    )

    return NextResponse.json({
      success: true,
      message: 'API key deleted'
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Delete API key error', { error })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})
