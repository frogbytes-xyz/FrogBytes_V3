import { createClient } from '@/services/supabase/server'
import { redirect } from 'next/navigation'
import { UserTierDisplay } from '@/components/features/user-tier-display'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Gift, Users, Zap } from 'lucide-react'
import Link from 'next/link'

/**
 * Usage Dashboard Page
 * Displays user's current tier, usage statistics, and upgrade options
 */
export default async function UsagePage(): Promise<JSX.Element> {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">Usage & Tier Management</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Monitor your daily usage, manage your tier, and invite friends to unlock unlimited access.
          </p>
        </div>

        {/* Main Usage Display */}
        <UserTierDisplay />

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5" />
                Invite Friends
              </CardTitle>
              <CardDescription>
                Share FrogBytes with friends and unlock unlimited access
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/dashboard/invitations">
                <Button className="w-full">
                  <Gift className="h-4 w-4 mr-2" />
                  Manage Invitations
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Zap className="h-5 w-5" />
                Upgrade Benefits
              </CardTitle>
              <CardDescription>
                See what you get with unlimited access
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/pricing">
                <Button variant="outline" className="w-full">
                  View Benefits
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Users className="h-5 w-5" />
                Help & Support
              </CardTitle>
              <CardDescription>
                Get help with invitations and tier management
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/help">
                <Button variant="outline" className="w-full">
                  Get Help
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Usage Tips */}
        <Card>
          <CardHeader>
            <CardTitle>How to Get Unlimited Access</CardTitle>
            <CardDescription>
              Follow these steps to unlock unlimited questions, quiz generation, and copilot interactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold">Send Invitations</h3>
                  <p className="text-gray-600 text-sm">
                    Invite 3 friends to join FrogBytes using your unique invitation links.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold">Friends Sign Up</h3>
                  <p className="text-gray-600 text-sm">
                    Your friends need to create accounts using your invitation links within 7 days.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold">Automatic Upgrade</h3>
                  <p className="text-gray-600 text-sm">
                    Once 3 friends successfully sign up, you'll automatically get unlimited access for 30 days!
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                <Gift className="h-4 w-4" />
                Pro Tip
              </div>
              <p className="text-green-700 text-sm">
                Share your invitations with friends who are interested in AI-powered learning, studying, or
                professional development. They'll get access to our powerful PDF analysis and quiz generation tools!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}