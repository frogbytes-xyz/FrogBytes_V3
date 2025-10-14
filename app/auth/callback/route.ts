import { createClient } from '@/services/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Auth Callback Handler
 * 
 * This route handles OAuth callbacks from social providers (Google, GitHub, etc.)
 * and magic link email confirmations. It exchanges the authorization code for a session.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors (e.g., user denied access, provider not configured)
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  // No code means invalid callback
  if (!code) {
    return NextResponse.redirect(
      new URL('/auth?error=no_code', request.url)
    )
  }

  try {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      return NextResponse.redirect(
        new URL(`/auth?error=${encodeURIComponent(exchangeError.message)}`, request.url)
      )
    }

    // Successful authentication - redirect to the next page
    return NextResponse.redirect(new URL(next, request.url))
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(
      new URL('/auth?error=callback_failed', request.url)
    )
  }
}
