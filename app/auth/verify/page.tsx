'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Mail, RefreshCw } from 'lucide-react'
import Menubar from '@/components/layout/Menubar'

/**
 * Email Verification Page
 *
 * This page is shown after successful registration when email confirmation is required.
 * It provides clear instructions and allows users to resend confirmation emails.
 */
export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email] = useState(searchParams.get('email') || '')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const handleResendConfirmation = async () => {
    if (!email) {
      setResendMessage('Email address not found. Please try registering again.')
      return
    }

    setResending(true)
    setResendMessage('')

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!data.success) {
        setResendMessage(
          data.error || 'Failed to resend confirmation email. Please try again.'
        )
        return
      }

      setResendMessage('Confirmation email sent! Please check your inbox.')
    } catch (error) {
      setResendMessage('Failed to resend confirmation email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const handleCheckEmail = () => {
    // For now, just show a message
    setResendMessage(
      'Please check your email inbox and spam folder for the confirmation email.'
    )
  }

  return (
    <>
      <Menubar />
      <main className="min-h-screen flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-md space-y-8">
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Mail className="h-12 w-12 text-blue-500" />
              </div>
              <CardTitle className="text-2xl text-blue-900">
                Check Your Email
              </CardTitle>
              <CardDescription className="text-blue-700">
                We've sent a confirmation link to your email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-blue-800 mb-4">
                  <strong>Almost there!</strong> To complete your registration,
                  please check your email and click the confirmation link we
                  just sent to:
                </p>
                <p className="font-mono text-sm bg-blue-100 px-3 py-2 rounded border">
                  {email}
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleCheckEmail}
                  className="w-full"
                  variant="outline"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Open Email Client
                </Button>

                <Button
                  onClick={handleResendConfirmation}
                  disabled={resending}
                  className="w-full"
                  variant="secondary"
                >
                  {resending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend Confirmation Email
                    </>
                  )}
                </Button>
              </div>

              {resendMessage && (
                <div
                  className={`p-3 rounded text-sm ${
                    resendMessage.includes('sent')
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {resendMessage}
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  📧 Can't find the email?
                </h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Check your spam/junk folder</li>
                  <li>• Make sure you entered the correct email address</li>
                  <li>• Wait a few minutes for the email to arrive</li>
                  <li>• Try resending the confirmation email</li>
                </ul>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  Once you've confirmed your email, you'll be able to sign in to
                  your account.
                </p>
                <Button
                  onClick={() => router.push('/login')}
                  variant="ghost"
                  className="text-sm"
                >
                  Go to Login Page
                </Button>
              </div>
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
