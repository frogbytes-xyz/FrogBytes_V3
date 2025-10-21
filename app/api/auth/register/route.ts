import { createClient } from '@/services/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for registration
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  full_name: z.string().min(1, 'Full name is required').max(255),
  university: z.string().optional(),
})

export type RegisterRequest = z.infer<typeof registerSchema>

export interface RegisterResponse {
  success: boolean
  message: string
  user?: {
    id: string
    email: string
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * POST /api/auth/register
 * 
 * Register a new user with email and password.
 * This endpoint uses Supabase Auth which automatically:
 * - Hashes the password securely
 * - Creates an entry in auth.users
 * - Triggers handle_new_user() to create public.users profile
 * 
 * @param request - Contains email, password, full_name, and optional university
 * @returns 201 on success, 400 for validation errors, 409 for duplicate email
 */
export async function POST(request: NextRequest) {
import { logger } from '@/lib/utils/logger'
  try {
    // Parse and validate request body
    const body = await request.json()
    const validation = registerSchema.safeParse(body)

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

    const { email, password, full_name, university } = validation.data

    // Create Supabase client
    const supabase = await createClient()

    // Attempt to sign up the user
    // Supabase Auth handles password hashing automatically
    // The user metadata (full_name, university) will be passed to the handle_new_user trigger
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          university: university || null,
        },
      },
    })

    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: 'User already exists',
            details: ['An account with this email address already exists'],
          },
          { status: 409 }
        )
      }

      // Handle weak password errors
      if (error.message.includes('password')) {
        return NextResponse.json<ErrorResponse>(
          {
            success: false,
            error: 'Password validation failed',
            details: [error.message],
          },
          { status: 400 }
        )
      }

      // Generic error
      logger.error('Supabase signup error', error)
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Registration failed',
          details: [error.message],
        },
        { status: 500 }
      )
    }

    if (!data.user) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Registration failed',
          details: ['User creation failed'],
        },
        { status: 500 }
      )
    }

    // Success response
    return NextResponse.json<RegisterResponse>(
      {
        success: true,
        message: 'User registered successfully',
        user: {
          id: data.user.id,
          email: data.user.email!,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    // Handle unexpected errors
    logger.error('Unexpected registration error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred during registration'],
      },
      { status: 500 }
    )
  }
}
