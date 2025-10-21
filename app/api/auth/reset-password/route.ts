import { createClient } from '@/services/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
})

export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>

export interface ResetPasswordResponse {
  success: boolean
  message: string
}

export async function POST(request: NextRequest) {
import { logger } from '@/lib/utils/logger'
  try {
    const body = await request.json()
    
    // Validate request body
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => err.message),
        },
        { status: 400 }
      )
    }

    const { email } = validationResult.data
    const supabase = await createClient()

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?next=/reset-password`,
    })

    if (error) {
      logger.error('Password reset error', error)
      // Don't reveal if email exists or not for security
      return NextResponse.json(
        {
          success: true,
          message: 'If an account exists with this email, you will receive password reset instructions.',
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Password reset instructions sent to your email.',
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Password reset request error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process password reset request',
      },
      { status: 500 }
    )
  }
}
