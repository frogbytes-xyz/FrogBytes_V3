import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createErrorResponse } from './lib/middleware/error-handler'

// Note: Global error handlers are not set up in Edge Runtime middleware
// Error handling is done at the individual route level

/**
 * Simple in-memory cache for middleware performance
 */
class MiddlewareCache {
  private cache = new Map<string, { user: any; timestamp: number }>()
  private maxAge = 5 * 60 * 1000 // 5 minutes
  private maxSize = 100 // Maximum cached users

  get(userId: string): any | null {
    const cached = this.cache.get(userId)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.maxAge) {
      this.cache.delete(userId)
      return null
    }

    return cached.user
  }

  set(userId: string, user: any): void {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(userId, { user, timestamp: Date.now() })
  }

  clear(): void {
    this.cache.clear()
  }
}

const middlewareCache = new MiddlewareCache()

/**
 * Enhanced error handling for middleware with file system error recovery
 */
function handleMiddlewareError(
  error: unknown,
  request: NextRequest
): NextResponse {
  // Log the error with context
  console.error('[Middleware] Error occurred:', {
    error: error instanceof Error ? error.message : 'Unknown error',
    pathname: request.nextUrl.pathname,
    method: request.method,
    timestamp: new Date().toISOString()
  })

  // Handle specific file system errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Handle ENOENT errors (file not found) gracefully
    if (message.includes('enoent') || message.includes('no such file')) {
      console.warn(
        '[Middleware] File system error detected, continuing with request'
      )
      // Don't block the request for file system errors
      return NextResponse.next()
    }

    // Handle other file system errors
    if (message.includes('eacces') || message.includes('eperm')) {
      console.warn(
        '[Middleware] File system permission error, continuing with request'
      )
      return NextResponse.next()
    }
  }

  // For other errors, use the standard error response
  return createErrorResponse(error, crypto.randomUUID())
}

/**
 * Next.js Middleware for Authentication
 *
 * This middleware runs on specified routes before the request reaches the route handler.
 * It verifies JWT tokens from Supabase Auth and protects routes requiring authentication.
 *
 * Protected routes: /api/* (except /api/auth/*)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth check for login/register endpoints
  if (
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/register')
  ) {
    return NextResponse.next()
  }

  //Only protect /api routes (add more patterns as needed)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Add performance optimization: skip heavy operations for health checks
  if (pathname === '/api/health') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  try {
    // Check cache first for performance
    const authHeader = request.headers.get('authorization')
    const sessionToken =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('sb-access-token')?.value

    if (sessionToken) {
      const cachedUser = middlewareCache.get(sessionToken)
      if (cachedUser) {
        // User is authenticated - add user ID to headers for route handlers
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-user-id', cachedUser.id)
        requestHeaders.set('x-user-email', cachedUser.email || '')

        return NextResponse.next({
          request: {
            headers: requestHeaders
          }
        })
      }
    }

    // Create Supabase client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options: _options }) => {
              request.cookies.set(name, value)
            })
            response = NextResponse.next({
              request
            })
            cookiesToSet.forEach(({ name, value, options: _options }) => {
              response.cookies.set(name, value, _options)
            })
          }
        }
      }
    )

    // Verify the session by getting the user
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error || !user) {
      // No valid session - return 401
      return createErrorResponse(
        new Error('Authentication required'),
        crypto.randomUUID()
      )
    }

    // Cache successful authentication for performance
    if (sessionToken) {
      middlewareCache.set(sessionToken, user)
    }

    // User is authenticated - add user ID to headers for route handlers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-email', user.email || '')

    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    })
  } catch (error) {
    return handleMiddlewareError(error, request)
  }
}

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all API routes except:
     * - /api/auth/* (login, register, callback, etc.)
     * - /api/cron/*
     * - /api/admin/*
     */
    '/api/:path((?!auth/|cron/|admin/).*)'
  ]
}
