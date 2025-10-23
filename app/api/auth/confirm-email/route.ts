import { createClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

/**
 * POST /api/auth/confirm-email
 *
 * Admin endpoint to manually confirm user emails for testing
 * This is a temporary solution for development/testing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the user by email
    const {
      data: { users },
      error: getUserError
    } = await supabase.auth.admin.listUsers()

    if (getUserError) {
      logger.error('Error fetching users', getUserError)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    const user = users.find(u => u.email === email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user to confirm email
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    })

    if (error) {
      logger.error('Error confirming email', error)
      return NextResponse.json(
        { error: 'Failed to confirm email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email confirmed successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed: data.user.email_confirmed_at ? true : false
      }
    })
  } catch (error) {
    logger.error('Confirm email error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
