'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Clock,
  Users,
  Zap,
  MessageSquare,
  HelpCircle
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UsageData {
  currentTier: 'free' | 'unlimited'
  tierExpiresAt: string | null
  questionsUsed: number
  questionsLimit: number
  quizQuestionsUsed: number
  quizQuestionsLimit: number
  copilotInteractionsUsed: number
  copilotInteractionsLimit: number
  successfulInvitations: number
  timeUntilReset: string
  questionsPercentage: number
  quizQuestionsPercentage: number
  copilotInteractionsPercentage: number
  isNearQuestionsLimit: boolean
  isNearQuizQuestionsLimit: boolean
  isNearCopilotLimit: boolean
}

interface TierInfo {
  profile: {
    tier: 'free' | 'unlimited'
    tierExpiresAt: string | null
  }
  tierDisplay: {
    name: string
    color: string
    badge: string
    status: string
  }
  daysUntilExpiration: number | null
  isExpiringSoon: boolean
  upgradeInfo: {
    canUpgrade: boolean
    successfulInvitations: number
    requiredInvitations: number
    invitationsNeeded: number
  }
}

export function UserTierDisplay(): JSX.Element {
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const [usageResponse, tierResponse] = await Promise.all([
        fetch('/api/user/usage'),
        fetch('/api/user/tier')
      ])

      if (!usageResponse.ok || !tierResponse.ok) {
        throw new Error('Failed to fetch user data')
      }

      const usageResult = await usageResponse.json()
      const tierResult = await tierResponse.json()

      setUsageData(usageResult.data)
      setTierInfo(tierResult.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    )
  }

  if (error || !usageData || !tierInfo) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Failed to load usage data'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const isUnlimited = usageData.currentTier === 'unlimited'

  return (
    <div className="space-y-6">
      {/* Tier Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Your Plan
              </CardTitle>
              <CardDescription>
                Current usage and tier information
              </CardDescription>
            </div>
            <Badge className={tierInfo.tierDisplay.badge}>
              {tierInfo.tierDisplay.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium">Status</span>
            <span className={`text-sm ${tierInfo.tierDisplay.color}`}>
              {tierInfo.tierDisplay.status}
            </span>
          </div>

          {/* Expiration Warning */}
          {tierInfo.isExpiringSoon && tierInfo.daysUntilExpiration !== null && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Your {tierInfo.tierDisplay.name} tier expires in{' '}
                {tierInfo.daysUntilExpiration} days.
                {tierInfo.upgradeInfo.canUpgrade
                  ? ' You can extend it by inviting more friends!'
                  : ''}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Daily Usage
          </CardTitle>
          <CardDescription>
            Resets in {usageData.timeUntilReset}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Questions Asked */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Questions Asked
              </span>
              <span className="text-sm text-gray-600">
                {usageData.questionsUsed} /{' '}
                {isUnlimited ? '∞' : usageData.questionsLimit}
              </span>
            </div>
            {!isUnlimited && (
              <div className="space-y-1">
                <Progress value={usageData.questionsPercentage} />
                {usageData.isNearQuestionsLimit && (
                  <p className="text-xs text-orange-600">
                    You're close to your daily limit!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quiz Questions Generated */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Quiz Questions Generated
              </span>
              <span className="text-sm text-gray-600">
                {usageData.quizQuestionsUsed} /{' '}
                {isUnlimited ? '∞' : usageData.quizQuestionsLimit}
              </span>
            </div>
            {!isUnlimited && (
              <div className="space-y-1">
                <Progress value={usageData.quizQuestionsPercentage} />
                {usageData.isNearQuizQuestionsLimit && (
                  <p className="text-xs text-orange-600">
                    You're close to your daily limit!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Copilot Interactions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Copilot Interactions
              </span>
              <span className="text-sm text-gray-600">
                {usageData.copilotInteractionsUsed} /{' '}
                {isUnlimited ? '∞' : usageData.copilotInteractionsLimit}
              </span>
            </div>
            {!isUnlimited && (
              <div className="space-y-1">
                <Progress value={usageData.copilotInteractionsPercentage} />
                {usageData.isNearCopilotLimit && (
                  <p className="text-xs text-orange-600">
                    You're close to your daily limit!
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Card */}
      {!tierInfo.upgradeInfo.canUpgrade && usageData.currentTier === 'free' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Get Unlimited Access
            </CardTitle>
            <CardDescription>
              Invite {tierInfo.upgradeInfo.invitationsNeeded} more friends to
              unlock unlimited usage for 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">
                  Successful Invitations
                </span>
                <span className="text-sm font-bold text-blue-600">
                  {tierInfo.upgradeInfo.successfulInvitations} /{' '}
                  {tierInfo.upgradeInfo.requiredInvitations}
                </span>
              </div>
              <Progress
                value={
                  (tierInfo.upgradeInfo.successfulInvitations /
                    tierInfo.upgradeInfo.requiredInvitations) *
                  100
                }
                className="h-2"
              />
              <Button
                onClick={() =>
                  (window.location.href = '/dashboard/invitations')
                }
                className="w-full"
              >
                Invite Friends
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {tierInfo.upgradeInfo.canUpgrade && usageData.currentTier === 'free' && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Congratulations! You&apos;ve invited{' '}
              {tierInfo.upgradeInfo.successfulInvitations} friends. Your upgrade
              to unlimited access is being processed.
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
