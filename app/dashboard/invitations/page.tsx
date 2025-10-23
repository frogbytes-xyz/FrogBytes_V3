import { createClient } from '@/services/supabase/server'
import { redirect } from 'next/navigation'
import { InvitationManager } from '@/components/features/invitation-manager'

/**
 * Invitations Management Page
 * Allows users to send invitations and track their progress
 */
export default async function InvitationsPage(): Promise<JSX.Element> {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Invitation Management
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Invite friends to FrogBytes and unlock unlimited access when 3
            friends successfully join.
          </p>
        </div>

        {/* Invitation Manager Component */}
        <InvitationManager />
      </div>
    </div>
  )
}
