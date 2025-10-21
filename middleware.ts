import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createErrorResponse, setupGlobalErrorHandlers } from './lib/middleware/error-handler'

// Setup global error handlers (only works in Node.js runtime, not Edge Runtime)
try {
  setupGlobalErrorHandlers()
} catch (error) {
  // Silently fail in Edge Runtime - error handling will be done at route level
  console.warn('Could not setup global error handlers:', error)
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

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
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
              request,
            })
            cookiesToSet.forEach(({ name, value, options: _options }) => {
              response.cookies.set(name, value, _options)
            })
          },
        },
      }
    )

    // Verify the session by getting the user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      // No valid session - return 401
      return createErrorResponse(
        new Error('Authentication required'),
        crypto.randomUUID()
      )
    }

    // User is authenticated - add user ID to headers for route handlers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', user.id)
    requestHeaders.set('x-user-email', user.email || '')

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    return createErrorResponse(error, crypto.randomUUID())
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
    '/api/:path((?!auth/|cron/|admin/).*)',
  ],
}
