'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import Menubar from '@/components/layout/Menubar'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      if (searchParams.get('confirm') === 'true') {
        setSuccess(
          'Account created successfully! Please check your email to confirm your account, then sign in.'
        )
      } else {
        setSuccess('Account created successfully! Please sign in.')
      }
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details?.[0] || data.error || 'Login failed')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Menubar />
      <main className="min-h-screen flex items-center justify-center p-4 pt-24">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to continue your learning journey
            </p>
          </div>

          <Card className="border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="text-lg font-medium leading-none tracking-tight mb-2">
                Sign In
              </CardTitle>
              <CardDescription className="text-sm text-[#606060]">
                Enter your email and password to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {success && (
                  <div className="p-3 bg-accent border text-sm">{success}</div>
                )}

                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-accent transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="text-xs text-muted-foreground">
                        {showPassword ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <Link
                    href="/forgot-password"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t">
                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/register"
                    className="text-foreground hover:underline"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to homepage
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
