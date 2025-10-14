import { createClient } from '@/services/supabase/server'
import { DatabaseError } from '@/lib/utils/errors'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/services/supabase/database.types'

type DbClient = SupabaseClient<Database>

export type UserTier = 'free' | 'unlimited'

export interface UserProfile {
  id: string
  email: string
  username: string | null
  fullName: string | null
  avatarUrl: string | null
  tier: UserTier
  tierExpiresAt: string | null
  invitedBy: string | null
  invitationCode: string | null
  createdAt: string
  updatedAt: string
}

export interface TierUpgrade {
  id: string
  userId: string
  fromTier: UserTier
  toTier: UserTier
  upgradeReason: string
  successfulInvitations: number
  expiresAt: string | null
  createdAt: string
}

export interface TierBenefits {
  questionsPerDay: number
  quizQuestionsPerDay: number
  copilotInteractionsPerDay: number
  features: string[]
  price?: string
}

export const TIER_BENEFITS: Record<UserTier, TierBenefits> = {
  free: {
    questionsPerDay: 10,
    quizQuestionsPerDay: 15,
    copilotInteractionsPerDay: 20,
    features: [
      'Basic PDF interactions',
      'Limited daily questions',
      'Basic quiz generation',
      'Community support'
    ],
    price: 'Free'
  },
  unlimited: {
    questionsPerDay: 999999,
    quizQuestionsPerDay: 999999,
    copilotInteractionsPerDay: 999999,
    features: [
      'Unlimited PDF interactions',
      'Unlimited daily questions',
      'Advanced quiz generation',
      'Priority AI responses',
      'Advanced analytics',
      'Priority support'
    ],
    price: 'Invite 3 friends'
  }
}

export class UserTierService {
  private supabase: DbClient

  constructor(supabaseClient: DbClient) {
    this.supabase = supabaseClient
  }

  /**
   * Get user profile with tier information
   * Note: user_profiles table exists but isn't in generated types yet
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await (this.supabase as any)
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new DatabaseError(
          `Failed to fetch user profile: ${error.message}`,
          'select',
          'user_profiles'
        )
      }

      if (!data) return null

      return this.mapToUserProfile(data)
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching user profile',
        'select',
        'user_profiles'
      )
    }
  }

  /**
   * Create or update user profile
   * Note: user_profiles table exists but isn't in generated types yet
   */
  async upsertUserProfile(
    userId: string,
    email: string,
    updates: Partial<{
      username: string
      fullName: string
      avatarUrl: string
    }> = {}
  ): Promise<UserProfile> {
    try {
      const { data, error } = await (this.supabase as any)
        .from('user_profiles')
        .upsert({
          id: userId,
          email,
          ...updates
        })
        .select()
        .single()

      if (error) {
        throw new DatabaseError(
          `Failed to upsert user profile: ${error.message}`,
          'upsert',
          'user_profiles'
        )
      }

      return this.mapToUserProfile(data)
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error upserting user profile',
        'upsert',
        'user_profiles'
      )
    }
  }

  /**
   * Check if user's tier has expired and downgrade if necessary
   * Note: RPC function exists but isn't in generated types yet
   */
  async checkTierExpiration(userId: string): Promise<UserTier> {
    try {
      const { data, error } = await (this.supabase as any).rpc('check_tier_expiration', { user_id_param: userId })

      if (error) {
        throw new DatabaseError(
          `Failed to check tier expiration: ${error.message}`,
          'rpc',
          'check_tier_expiration'
        )
      }

      return data as UserTier
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error checking tier expiration',
        'rpc',
        'check_tier_expiration'
      )
    }
  }

  /**
   * Manually upgrade user tier (admin function)
   */
  async upgradeUserTier(
    userId: string,
    toTier: UserTier,
    reason: string = 'admin_grant',
    durationDays?: number
  ): Promise<boolean> {
    try {
      // Get current tier
      const profile = await this.getUserProfile(userId)
      if (!profile) {
        throw new DatabaseError(
          'User profile not found',
          'select',
          'user_profiles'
        )
      }

      const expiresAt = durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
        : null

      // Update user tier
      const { error: updateError } = await (this.supabase as any)
        .from('user_profiles')
        .update({
          tier: toTier,
          tier_expires_at: expiresAt
        })
        .eq('id', userId)

      if (updateError) {
        throw new DatabaseError(
          `Failed to upgrade user tier: ${updateError.message}`,
          'update',
          'user_profiles'
        )
      }

      // Record upgrade
      const { error: upgradeError } = await (this.supabase as any)
        .from('user_tier_upgrades')
        .insert({
          user_id: userId,
          from_tier: profile.tier,
          to_tier: toTier,
          upgrade_reason: reason,
          expires_at: expiresAt
        })

      if (upgradeError) {
        console.warn('Failed to record tier upgrade:', upgradeError)
      }

      return true
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error upgrading user tier',
        'update',
        'user_profiles'
      )
    }
  }

  /**
   * Get user's tier upgrade history
   * Note: user_tier_upgrades table exists but isn't in generated types yet
   */
  async getTierUpgradeHistory(userId: string): Promise<TierUpgrade[]> {
    try {
      const { data, error} = await (this.supabase as any)
        .from('user_tier_upgrades')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new DatabaseError(
          `Failed to fetch tier upgrade history: ${error.message}`,
          'select',
          'user_tier_upgrades'
        )
      }

      return data.map(this.mapToTierUpgrade)
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching tier upgrade history',
        'select',
        'user_tier_upgrades'
      )
    }
  }

  /**
   * Get tier benefits for a specific tier
   */
  getTierBenefits(tier: UserTier): TierBenefits {
    return TIER_BENEFITS[tier]
  }

  /**
   * Get all available tiers with benefits
   */
  getAllTierBenefits(): Record<UserTier, TierBenefits> {
    return TIER_BENEFITS
  }

  /**
   * Check if user can be upgraded to unlimited tier
   * Note: user_invitations table exists but isn't in generated types yet
   */
  async canUpgradeToUnlimited(userId: string): Promise<{
    canUpgrade: boolean
    successfulInvitations: number
    requiredInvitations: number
  }> {
    try {
      const { data, error } = await (this.supabase as any)
        .from('user_invitations')
        .select('status')
        .eq('inviter_id', userId)
        .eq('status', 'accepted')
        .not('invitee_id', 'is', null)

      if (error) {
        throw new DatabaseError(
          `Failed to check upgrade eligibility: ${error.message}`,
          'select',
          'user_invitations'
        )
      }

      const successfulInvitations = data.length
      const requiredInvitations = 3

      return {
        canUpgrade: successfulInvitations >= requiredInvitations,
        successfulInvitations,
        requiredInvitations
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error checking upgrade eligibility',
        'select',
        'user_invitations'
      )
    }
  }

  /**
   * Get days remaining until tier expires
   */
  getDaysUntilExpiration(tierExpiresAt: string | null): number | null {
    if (!tierExpiresAt) return null

    const expirationDate = new Date(tierExpiresAt)
    const now = new Date()
    const diffTime = expirationDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays > 0 ? diffDays : 0
  }

  /**
   * Check if tier is about to expire (within 7 days)
   */
  isTierExpiringSoon(tierExpiresAt: string | null): boolean {
    const daysRemaining = this.getDaysUntilExpiration(tierExpiresAt)
    return daysRemaining !== null && daysRemaining <= 7
  }

  /**
   * Get tier display information
   */
  getTierDisplay(tier: UserTier, tierExpiresAt: string | null): {
    name: string
    color: string
    badge: string
    status: string
  } {
    const daysRemaining = this.getDaysUntilExpiration(tierExpiresAt)

    switch (tier) {
      case 'unlimited':
        if (daysRemaining !== null) {
          return {
            name: 'Unlimited',
            color: 'text-purple-600',
            badge: 'bg-purple-100 text-purple-800',
            status: daysRemaining > 0
              ? `${daysRemaining} days remaining`
              : 'Expired'
          }
        }
        return {
          name: 'Unlimited',
          color: 'text-purple-600',
          badge: 'bg-purple-100 text-purple-800',
          status: 'Active'
        }
      case 'free':
      default:
        return {
          name: 'Free',
          color: 'text-gray-600',
          badge: 'bg-gray-100 text-gray-800',
          status: 'Active'
        }
    }
  }

  /**
   * Private helper methods
   */
  private mapToUserProfile(data: Record<string, unknown>): UserProfile {
    return {
      id: String(data.id),
      email: String(data.email),
      username: data.username ? String(data.username) : null,
      fullName: data.full_name ? String(data.full_name) : null,
      avatarUrl: data.avatar_url ? String(data.avatar_url) : null,
      tier: String(data.tier) as UserTier,
      tierExpiresAt: data.tier_expires_at ? String(data.tier_expires_at) : null,
      invitedBy: data.invited_by ? String(data.invited_by) : null,
      invitationCode: data.invitation_code ? String(data.invitation_code) : null,
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at)
    }
  }

  private mapToTierUpgrade(data: Record<string, unknown>): TierUpgrade {
    return {
      id: String(data.id),
      userId: String(data.user_id),
      fromTier: String(data.from_tier) as UserTier,
      toTier: String(data.to_tier) as UserTier,
      upgradeReason: String(data.upgrade_reason),
      successfulInvitations: Number(data.successful_invitations) || 0,
      expiresAt: data.expires_at ? String(data.expires_at) : null,
      createdAt: String(data.created_at)
    }
  }
}

/**
 * Factory function to create user tier service with server client
 */
export async function createUserTierService(): Promise<UserTierService> {
  const supabase = await createClient()
  return new UserTierService(supabase as any)
}

/**
 * Hook-like function to get user tier information (for use in components)
 */
export async function getUserTierInfo(userId: string): Promise<{
  profile: UserProfile | null
  tierBenefits: TierBenefits
  canUpgrade: boolean
  upgradeInfo: {
    successfulInvitations: number
    requiredInvitations: number
  }
}> {
  const tierService = await createUserTierService()

  const [profile, upgradeInfo] = await Promise.all([
    tierService.getUserProfile(userId),
    tierService.canUpgradeToUnlimited(userId)
  ])

  const tierBenefits = profile
    ? tierService.getTierBenefits(profile.tier)
    : tierService.getTierBenefits('free')

  return {
    profile,
    tierBenefits,
    canUpgrade: upgradeInfo.canUpgrade,
    upgradeInfo: {
      successfulInvitations: upgradeInfo.successfulInvitations,
      requiredInvitations: upgradeInfo.requiredInvitations
    }
  }
}