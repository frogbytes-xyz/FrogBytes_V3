import { createClient } from '@/services/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for login
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginRequest = z.infer<typeof loginSchema>

export interface LoginResponse {
  success: boolean
  message: string
  session?: {
    access_token: string
    refresh_token: string
    expires_in: number
    expires_at: number
    token_type: string
  }
  user?: {
    id: string
    email: string
    full_name?: string | null
    university?: string | null
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * POST /api/auth/login
 * 
 * Authenticate a user with email and password.
 * This endpoint uses Supabase Auth which automatically:
 * - Verifies the password against the stored hash
 * - Generates JWT access and refresh tokens
 * - Creates a session
 * 
 * @param request - Contains email and password
 * @returns 200 on success with JWT tokens, 400 for validation, 401 for auth failure
 */
export async function POST(request: NextRequest) {
import { logger } from '@/lib/utils/logger'
  try {
    // Parse and validate request body
    const body = await request.json()
    const validation = loginSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      )
    }

    const { email, password } = validation.data

    // Create Supabase client
    const supabase = await createClient()

    // Attempt to sign in
    // Supabase Auth handles password comparison and JWT generation automatically
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Handle authentication errors
      if (
        error.message.includes('Invalid login credentials') ||
        error.message.includes('Email not confirmed') ||
        error.message.includes('Invalid')
      ) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: 'Authentication failed',
            details: ['Invalid email or password'],
          },
          { status: 401 }
        )
      }

      // Generic error
      logger.error('Supabase signin error', error)
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Login failed',
          details: [error.message],
        },
        { status: 500 }
      )
    }

    if (!data.session || !data.user) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Login failed',
          details: ['Session creation failed'],
        },
        { status: 500 }
      )
    }

    // Fetch user profile from public.users for additional info
    const { data: profile } = await supabase
      .from('users')
      .select('full_name, university')
      .eq('id', data.user.id)
      .single()

    // Success response with session and user data
    return NextResponse.json<LoginResponse>(
      {
        success: true,
        message: 'Login successful',
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in || 3600,
          expires_at: data.session.expires_at || Date.now() / 1000 + 3600,
          token_type: data.session.token_type || 'bearer',
        },
        user: {
          id: data.user.id,
          email: data.user.email!,
          full_name: (profile as any)?.full_name || null,
          university: (profile as any)?.university || null,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    // Handle unexpected errors
    logger.error('Unexpected login error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred during login'],
      },
      { status: 500 }
    )
  }
}
