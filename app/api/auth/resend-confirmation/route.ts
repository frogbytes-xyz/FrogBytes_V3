import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'
import { z } from 'zod'

const resendConfirmationSchema = z.object({
  email: z.string().email('Invalid email address')
})

/**
 * Resend Email Confirmation API Endpoint
 *
 * This endpoint allows users to resend their email confirmation
 * if they didn't receive the original email or it expired.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendConfirmationSchema.parse(body)

    const supabase = await createClient()

    // Resend the confirmation email
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email
    })

    if (resendError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to resend confirmation email'
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Confirmation email sent successfully'
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email address',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
