import { NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'
import { createUserTierService } from '@/lib/services/user-tier-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'

/**
 * GET /api/user/tier
 * Get user's tier information and benefits
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

    const tierService = await createUserTierService()

    const [profile, upgradeInfo, tierHistory] = await Promise.all([
      tierService.getUserProfile(user.id),
      tierService.canUpgradeToUnlimited(user.id),
      tierService.getTierUpgradeHistory(user.id)
    ])

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const tierBenefits = tierService.getTierBenefits(profile.tier)
    const allTierBenefits = tierService.getAllTierBenefits()
    const tierDisplay = tierService.getTierDisplay(profile.tier, profile.tierExpiresAt)
    const daysUntilExpiration = tierService.getDaysUntilExpiration(profile.tierExpiresAt)
    const isExpiringSoon = tierService.isTierExpiringSoon(profile.tierExpiresAt)

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email,
          username: profile.username,
          fullName: profile.fullName,
          tier: profile.tier,
          tierExpiresAt: profile.tierExpiresAt,
          invitedBy: profile.invitedBy
        },
        tierBenefits,
        allTierBenefits,
        tierDisplay,
        daysUntilExpiration,
        isExpiringSoon,
        upgradeInfo: {
          canUpgrade: upgradeInfo.canUpgrade,
          successfulInvitations: upgradeInfo.successfulInvitations,
          requiredInvitations: upgradeInfo.requiredInvitations,
          invitationsNeeded: Math.max(0, upgradeInfo.requiredInvitations - upgradeInfo.successfulInvitations)
        },
        tierHistory: tierHistory.slice(0, 5) // Last 5 upgrades
      }
    })
  } catch (error) {
    console.error('Error fetching tier information:', error)
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}