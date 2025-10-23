'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/services/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import Menubar from '@/components/layout/Menubar'

/**
 * Email Confirmation Page
 *
 * This page handles the email confirmation flow for new user registrations.
 * Users are redirected here after clicking the confirmation link in their email.
 */
export default function ConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<
    'loading' | 'success' | 'error' | 'expired'
  >('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const token = searchParams.get('token')
      const type = searchParams.get('type')
      const emailParam = searchParams.get('email')

      if (emailParam) {
        setEmail(emailParam)
      }

      if (!token || type !== 'signup') {
        setStatus('error')
        setMessage('Invalid confirmation link. Please try registering again.')
        return
      }

      try {
        const supabase = createClient()

        // Confirm the email
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        })

        if (error) {
          if (
            error.message.includes('expired') ||
            error.message.includes('invalid')
          ) {
            setStatus('expired')
            setMessage(
              'This confirmation link has expired or is invalid. Please request a new confirmation email.'
            )
          } else {
            setStatus('error')
            setMessage(
              'Failed to confirm your email. Please try again or contact support.'
            )
          }
          return
        }

        if (data.user) {
          setStatus('success')
          setMessage(
            'Your email has been confirmed successfully! You can now sign in to your account.'
          )

          // Redirect to login page after 3 seconds
          setTimeout(() => {
            router.push('/login?confirmed=true')
          }, 3000)
        }
      } catch (error) {
        setStatus('error')
        setMessage(
          'An unexpected error occurred. Please try again or contact support.'
        )
      }
    }

    handleEmailConfirmation()
  }, [searchParams, router])

  const handleResendConfirmation = async () => {
    if (!email) {
      setMessage(
        'Please enter your email address to resend the confirmation email.'
      )
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })

      if (error) {
        setMessage('Failed to resend confirmation email. Please try again.')
        return
      }

      setMessage('Confirmation email sent! Please check your inbox.')
    } catch (error) {
      setMessage('Failed to resend confirmation email. Please try again.')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />
      case 'error':
      case 'expired':
        return <XCircle className="h-12 w-12 text-red-500" />
      default:
        return <Mail className="h-12 w-12 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50'
      case 'error':
      case 'expired':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  return (
    <>
      <Menubar />
      <main className="min-h-screen flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-md space-y-8">
          <Card className={`${getStatusColor()} border-2`}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">{getStatusIcon()}</div>
              <CardTitle className="text-2xl">
                {status === 'loading' && 'Confirming Your Email...'}
                {status === 'success' && 'Email Confirmed!'}
                {status === 'error' && 'Confirmation Failed'}
                {status === 'expired' && 'Link Expired'}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {status === 'loading' &&
                  'Please wait while we confirm your email address.'}
                {status === 'success' && 'Your account is now ready to use.'}
                {status === 'error' &&
                  'We encountered an issue confirming your email.'}
                {status === 'expired' &&
                  'This confirmation link is no longer valid.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700 text-center">{message}</p>

              {status === 'success' && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Redirecting you to the login page...
                  </p>
                  <Button
                    onClick={() => router.push('/login?confirmed=true')}
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                </div>
              )}

              {(status === 'error' || status === 'expired') && (
                <div className="space-y-3">
                  <Button
                    onClick={() => router.push('/register')}
                    variant="outline"
                    className="w-full"
                  >
                    Try Registering Again
                  </Button>

                  {email && (
                    <Button
                      onClick={handleResendConfirmation}
                      variant="secondary"
                      className="w-full"
                    >
                      Resend Confirmation Email
                    </Button>
                  )}

                  <Button
                    onClick={() => router.push('/login')}
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                </div>
              )}

              {status === 'loading' && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    This may take a few moments...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Need help? Contact our support team.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
