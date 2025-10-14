import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'
import { createInvitationService, generateInvitationEmailContent } from '@/lib/services/invitation-service'
import { getSafeErrorMessage, ValidationError } from '@/lib/utils/errors'
import { emailSchema } from '@/lib/validations'

/**
 * GET /api/user/invitations
 * Get user's sent invitations and stats
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const invitationService = await createInvitationService()

    const [invitations, stats] = await Promise.all([
      invitationService.getUserInvitations(user.id),
      invitationService.getInvitationStats(user.id)
    ])

    return NextResponse.json({
      success: true,
      data: {
        invitations,
        stats
      }
    })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/invitations
 * Create a new invitation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email } = body

    // Validate email
    const emailValidation = emailSchema.safeParse(email)
    if (!emailValidation.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Get user profile for inviter name - handle gracefully if table doesn't exist
    let inviterName = user.email || 'Someone';
    
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single()
      
      if (profile) {
        inviterName = (profile as any)?.full_name || (profile as any)?.email || user.email || 'Someone';
      }
    } catch (error) {
      // Profile table might not exist, use fallback
      console.log('User profile lookup failed, using fallback name');
    }

    const invitationService = await createInvitationService()
    const invitation = await invitationService.createInvitation(user.id, email)

    // Generate invitation URL
    const invitationUrl = invitationService.generateInvitationUrl(invitation.invitationCode)

    // Generate email content (you would send this via your email service)
    const emailContent = generateInvitationEmailContent(inviterName, invitationUrl)

    // TODO: Send email using your preferred email service
    // For now, we'll just return the invitation details
    console.log('Invitation email content:', emailContent)

    return NextResponse.json({
      success: true,
      data: {
        invitation,
        invitationUrl,
        emailContent: {
          subject: emailContent.subject,
          // Don't expose full email content in API response for security
          previewText: `${inviterName} invited you to join FrogBytes!`
        }
      }
    })
  } catch (error) {
    console.error('Error creating invitation:', error)

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}