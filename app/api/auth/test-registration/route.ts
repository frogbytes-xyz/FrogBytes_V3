import { createClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

/**
 * POST /api/auth/test-registration
 *
 * Test endpoint to verify user registration flow
 * This endpoint helps debug registration issues by providing detailed information
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name, university } = body

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Test 1: Check if user already exists (not used in this test)
    // const { data: existingUser } = await supabase.auth.getUser()

    // Test 2: Try to sign up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          university: university || null
        }
      }
    })

    if (error) {
      logger.error('Registration test error', error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error
        },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User creation failed'
        },
        { status: 500 }
      )
    }

    // Test 3: Check if user profile was created
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    const { data: userProfileExtended } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Registration test completed',
      user: {
        id: data.user.id,
        email: data.user.email,
        email_confirmed: data.user.email_confirmed_at ? true : false
      },
      profiles: {
        users_table: userProfile,
        user_profiles_table: userProfileExtended
      },
      session: data.session
        ? {
            access_token: data.session.access_token ? 'present' : 'missing',
            refresh_token: data.session.refresh_token ? 'present' : 'missing'
          }
        : null
    })
  } catch (error) {
    logger.error('Registration test error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
