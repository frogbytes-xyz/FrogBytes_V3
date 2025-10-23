import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'
import { createInvitationService } from '@/lib/services/invitation-service'
import { getSafeErrorMessage, ValidationError } from '@/lib/utils/errors'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/user/invitations/[code]
 * Get invitation details by code
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  try {
    const { code } = await params

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Invalid invitation code' },
        { status: 400 }
      )
    }

    const invitationService = await createInvitationService()
    const invitation = await invitationService.getInvitationByCode(code)

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Check if invitation expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 } // Gone
      )
    }

    // Don&apos;t expose sensitive information
    const publicInvitation = {
      inviterEmail: invitation.inviterEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      isExpired: new Date(invitation.expiresAt) < new Date(),
      isAccepted: invitation.status === 'accepted'
    }

    return NextResponse.json({
      success: true,
      data: publicInvitation
    })
  } catch (error) {
    logger.error('Error fetching invitation', error)
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/invitations/[code]/accept
 * Accept an invitation
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  try {
    const { code } = await params

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Invalid invitation code' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to accept an invitation' },
        { status: 401 }
      )
    }

    const invitationService = await createInvitationService()
    const accepted = await invitationService.acceptInvitation(code, user.id)

    if (!accepted) {
      return NextResponse.json(
        { error: 'Failed to accept invitation' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully!'
    })
  } catch (error) {
    logger.error('Error accepting invitation', error)

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
