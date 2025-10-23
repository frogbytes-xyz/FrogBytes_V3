'use client'

import { logger } from '@/lib/utils/logger'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Mail,
  Copy,
  Check,
  Users,
  Clock,
  UserPlus,
  AlertTriangle,
  Gift
} from 'lucide-react'
import { emailSchema } from '@/lib/validations'

interface Invitation {
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

interface InvitationStats {
  totalSent: number
  totalAccepted: number
  totalPending: number
  totalExpired: number
  needsForUpgrade: number
}

interface InvitationData {
  invitations: Invitation[]
  stats: InvitationStats
}

export function InvitationManager(): JSX.Element {
  const [data, setData] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchInvitations()
  }, [])

  const fetchInvitations = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/user/invitations')
      if (!response.ok) {
        throw new Error('Failed to fetch invitations')
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load invitations'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSendInvitation = async (): Promise<void> => {
    try {
      setIsInviting(true)
      setInviteError(null)
      setInviteSuccess(null)

      // Validate email
      const emailValidation = emailSchema.safeParse(inviteEmail)
      if (!emailValidation.success) {
        setInviteError('Please enter a valid email address')
        return
      }

      const response = await fetch('/api/user/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: inviteEmail })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation')
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}!`)
      setInviteEmail('')
      setIsDialogOpen(false)

      // Refresh the invitations list
      await fetchInvitations()
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Failed to send invitation'
      )
    } finally {
      setIsInviting(false)
    }
  }

  const copyInvitationLink = async (invitationCode: string): Promise<void> => {
    const baseUrl = window.location.origin
    const invitationUrl = `${baseUrl}/invite/${invitationCode}`

    try {
      await navigator.clipboard.writeText(invitationUrl)
      setCopiedCode(invitationCode)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      logger.error('Failed to copy invitation link', err)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string): JSX.Element => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'expired':
        return <Badge className="bg-red-100 text-red-800">Expired</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
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

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Failed to load invitations'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {inviteSuccess && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>{inviteSuccess}</AlertDescription>
        </Alert>
      )}

      {inviteError && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{inviteError}</AlertDescription>
        </Alert>
      )}

      {/* Invitation Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Invitation Progress
              </CardTitle>
              <CardDescription>
                Invite {data.stats.needsForUpgrade} friends to unlock unlimited
                access
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Friend
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a Friend</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join FrogBytes. They&apos;ll get
                    access to our AI-powered learning platform!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="invite-email">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="friend@example.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyPress={e =>
                        e.key === 'Enter' && handleSendInvitation()
                      }
                    />
                  </div>
                  <Button
                    onClick={handleSendInvitation}
                    disabled={isInviting || !inviteEmail}
                    className="w-full"
                  >
                    {isInviting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {data.stats.totalSent}
              </div>
              <div className="text-sm text-gray-600">Total Sent</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {data.stats.totalAccepted}
              </div>
              <div className="text-sm text-gray-600">Accepted</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {data.stats.totalPending}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Math.max(
                  0,
                  data.stats.needsForUpgrade - data.stats.totalAccepted
                )}
              </div>
              <div className="text-sm text-gray-600">Needed</div>
            </div>
          </div>

          {data.stats.totalAccepted >= data.stats.needsForUpgrade && (
            <Alert className="mt-4">
              <Gift className="h-4 w-4" />
              <AlertDescription>
                🎉 Congratulations! You&apos;ve successfully invited{' '}
                {data.stats.totalAccepted} friends and unlocked unlimited
                access!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Your Invitations
          </CardTitle>
          <CardDescription>
            Manage and track your sent invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.invitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invitations sent yet</p>
              <p className="text-sm">
                Start inviting friends to unlock unlimited access!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.invitations.map(invitation => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{invitation.inviteeEmail}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Sent {formatDate(invitation.sentAt)}
                      </span>
                      {invitation.acceptedAt && (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Accepted {formatDate(invitation.acceptedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(invitation.status)}
                    {invitation.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyInvitationLink(invitation.invitationCode)
                        }
                      >
                        {copiedCode === invitation.invitationCode ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy Link
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Invitation Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <span>
                Share invitation links with friends who are interested in
                AI-powered learning
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <span>
                Invitations expire after 7 days, so encourage friends to sign up
                quickly
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <span>
                Once you have 3 successful invitations, you&apos;ll get
                unlimited access for 30 days
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
              <span>
                Your friends will also benefit from joining our growing learning
                community
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
