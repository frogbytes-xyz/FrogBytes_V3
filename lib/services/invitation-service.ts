import { createClient } from '@/services/supabase/server'
import { DatabaseError, ValidationError } from '@/lib/utils/errors'
import { emailSchema, validateWithSchema } from '@/lib/validations'
import { randomBytes } from 'crypto'

export interface Invitation {
  id: string
  inviterEmail: string
  inviteeEmail: string
  inviteeId: string | null
  invitationCode: string
  status: 'pending' | 'accepted' | 'expired'
  sentAt: string
  acceptedAt: string | null
  expiresAt: string
}

export interface InvitationStats {
  totalSent: number
  totalAccepted: number
  totalPending: number
  totalExpired: number
  needsForUpgrade: number
}

export class InvitationService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  /**
   * Create a new invitation
   */
  async createInvitation(inviterId: string, inviteeEmail: string): Promise<Invitation> {
    try {
      // Validate email
      validateWithSchema(emailSchema, inviteeEmail)

      // Check if user already exists
      const { data: existingUser } = await this.supabase
        .from('user_profiles')
        .select('id, email')
        .eq('email', inviteeEmail)
        .single()

      if (existingUser) {
        throw new ValidationError(
          'User with this email already exists',
          'inviteeEmail',
          'USER_EXISTS'
        )
      }

      // Check if invitation already exists and is pending
      const { data: existingInvitation } = await this.supabase
        .from('user_invitations')
        .select('*')
        .eq('inviter_id', inviterId)
        .eq('invitee_email', inviteeEmail)
        .eq('status', 'pending')
        .single()

      if (existingInvitation) {
        throw new ValidationError(
          'Invitation already sent to this email',
          'inviteeEmail',
          'INVITATION_EXISTS'
        )
      }

      // Generate unique invitation code
      const invitationCode = this.generateInvitationCode()

      // Create invitation
      const { data, error } = await this.supabase
        .from('user_invitations')
        .insert({
          inviter_id: inviterId,
          invitee_email: inviteeEmail,
          invitation_code: invitationCode,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        })
        .select(`
          *,
          inviter:user_profiles!inviter_id(email)
        `)
        .single()

      if (error) {
        throw new DatabaseError(
          `Failed to create invitation: ${error.message}`,
          'insert',
          'user_invitations'
        )
      }

      return this.mapToInvitation(data)
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error creating invitation',
        'insert',
        'user_invitations'
      )
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(invitationCode: string, userId: string): Promise<boolean> {
    try {
      // Get invitation
      const { data: invitation, error: fetchError } = await this.supabase
        .from('user_invitations')
        .select('*')
        .eq('invitation_code', invitationCode)
        .eq('status', 'pending')
        .single()

      if (fetchError || !invitation) {
        throw new ValidationError(
          'Invalid or expired invitation code',
          'invitationCode',
          'INVALID_INVITATION'
        )
      }

      // Check if invitation expired
      if (new Date(invitation.expires_at) < new Date()) {
        await this.supabase
          .from('user_invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id)

        throw new ValidationError(
          'Invitation has expired',
          'invitationCode',
          'INVITATION_EXPIRED'
        )
      }

      // Update invitation status and link to user
      const { error: updateError } = await this.supabase
        .from('user_invitations')
        .update({
          status: 'accepted',
          invitee_id: userId,
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (updateError) {
        throw new DatabaseError(
          `Failed to accept invitation: ${updateError.message}`,
          'update',
          'user_invitations'
        )
      }

      // Update user profile to track who invited them
      const { error: profileError } = await this.supabase
        .from('user_profiles')
        .update({
          invited_by: invitation.inviter_id,
          invitation_code: invitationCode
        })
        .eq('id', userId)

      if (profileError) {
        logger.warn('Failed to update user profile with invitation info', { error: profileError })
      }

      return true
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error accepting invitation',
        'update',
        'user_invitations'
      )
    }
  }

  /**
   * Get user's sent invitations
   */
  async getUserInvitations(userId: string): Promise<Invitation[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_invitations')
        .select(`
          *,
          inviter:user_profiles!inviter_id(email)
        `)
        .eq('inviter_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new DatabaseError(
          `Failed to fetch invitations: ${error.message}`,
          'select',
          'user_invitations'
        )
      }

  return data.map((d: any) => this.mapToInvitation(d))
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching invitations',
        'select',
        'user_invitations'
      )
    }
  }

  /**
   * Get invitation by code (for display purposes)
   */
  async getInvitationByCode(invitationCode: string): Promise<Invitation | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_invitations')
        .select(`
          *,
          inviter:user_profiles!inviter_id(email, full_name)
        `)
        .eq('invitation_code', invitationCode)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new DatabaseError(
          `Failed to fetch invitation: ${error.message}`,
          'select',
          'user_invitations'
        )
      }

      return data ? this.mapToInvitation(data) : null
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching invitation',
        'select',
        'user_invitations'
      )
    }
  }

  /**
   * Get invitation statistics for user
   */
  async getInvitationStats(userId: string): Promise<InvitationStats> {
    try {
      const { data, error } = await this.supabase
        .from('user_invitations')
        .select('status')
        .eq('inviter_id', userId)

      if (error) {
        throw new DatabaseError(
          `Failed to fetch invitation stats: ${error.message}`,
          'select',
          'user_invitations'
        )
      }

      const stats = data.reduce(
  (acc: any, inv: any) => {
          acc.totalSent++
          switch (inv.status) {
            case 'accepted':
              acc.totalAccepted++
              break
            case 'pending':
              acc.totalPending++
              break
            case 'expired':
              acc.totalExpired++
              break
          }
          return acc
        },
        {
          totalSent: 0,
          totalAccepted: 0,
          totalPending: 0,
          totalExpired: 0,
          needsForUpgrade: 3
        }
      )

      return stats
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching invitation stats',
        'select',
        'user_invitations'
      )
    }
  }

  /**
   * Expire old invitations (cleanup function)
   */
  async expireOldInvitations(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString())
        .select('id')

      if (error) {
        throw new DatabaseError(
          `Failed to expire invitations: ${error.message}`,
          'update',
          'user_invitations'
        )
      }

      return data?.length ?? 0
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error expiring invitations',
        'update',
        'user_invitations'
      )
    }
  }

  /**
   * Generate invitation URL
   */
  generateInvitationUrl(invitationCode: string, baseUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'): string {
    return `${baseUrl}/invite/${invitationCode}`
  }

  /**
   * Private helper methods
   */
  private generateInvitationCode(): string {
    return randomBytes(16).toString('hex')
  }

  private mapToInvitation(data: any): Invitation {
    return {
      id: data.id,
      inviterEmail: data.inviter?.email ?? '',
      inviteeEmail: data.invitee_email,
      inviteeId: data.invitee_id,
      invitationCode: data.invitation_code,
      status: data.status,
      sentAt: data.sent_at,
      acceptedAt: data.accepted_at,
      expiresAt: data.expires_at
    }
  }
}

/**
 * Factory function to create invitation service with server client
 */
export async function createInvitationService(): Promise<InvitationService> {
import { logger } from '@/lib/utils/logger'
  const supabase = await createClient()
  return new InvitationService(supabase)
}

/**
 * Email template for invitations
 */
export function generateInvitationEmailContent(
  inviterName: string,
  invitationUrl: string
): { subject: string; html: string; text: string } {
  const subject = `${inviterName} invited you to join FrogBytes!`

  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <h1 style="color: #10b981; text-align: center;">You're Invited to FrogBytes!</h1>

      <p>Hi there!</p>

      <p><strong>${inviterName}</strong> has invited you to join FrogBytes, the AI-powered learning platform that helps you master any subject through interactive PDFs, quizzes, and intelligent assistance.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationUrl}"
           style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Accept Invitation
        </a>
      </div>

      <p>With FrogBytes, you can:</p>
      <ul>
        <li>Upload and interact with PDF documents</li>
        <li>Get instant answers to your questions</li>
        <li>Generate custom quizzes to test your knowledge</li>
        <li>Chat with an AI copilot for learning assistance</li>
      </ul>

      <p>By joining through this invitation, you'll help ${inviterName} unlock premium features!</p>

      <p style="color: #666; font-size: 14px;">This invitation expires in 7 days. If the button doesn't work, copy and paste this link: ${invitationUrl}</p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        FrogBytes - AI-Powered Learning Platform
      </p>
    </div>
  `

  const text = `
${inviterName} invited you to join FrogBytes!

You've been invited to join FrogBytes, the AI-powered learning platform that helps you master any subject through interactive PDFs, quizzes, and intelligent assistance.

Accept your invitation: ${invitationUrl}

With FrogBytes, you can:
- Upload and interact with PDF documents
- Get instant answers to your questions
- Generate custom quizzes to test your knowledge
- Chat with an AI copilot for learning assistance

By joining through this invitation, you'll help ${inviterName} unlock premium features!

This invitation expires in 7 days.

---
FrogBytes - AI-Powered Learning Platform
  `

  return { subject, html, text }
}