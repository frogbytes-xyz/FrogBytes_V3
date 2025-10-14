import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/helpers'

/**
 * GET /api/test/protected
 * 
 * Test endpoint to verify authentication middleware is working.
 * This route is protected by the middleware and requires a valid JWT token.
 * 
 * @returns User information if authenticated
 */
export async function GET(request: NextRequest) {
  // Get authenticated user (middleware already verified token)
  const user = await getAuthUser(request)

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
        details: ['Authentication required'],
      },
      { status: 401 }
    )
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Access granted to protected route',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        university: user.university,
        reputation_score: user.reputation_score,
      },
    },
    { status: 200 }
  )
}
