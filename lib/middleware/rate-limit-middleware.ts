import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'
import { createRateLimitService, type UsageType, type UserUsageStatus as UsageStatus } from '@/lib/services/rate-limit-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'

export interface RateLimitOptions {
  usageType: UsageType
  increment?: number
  skipIncrement?: boolean
  requireAuth?: boolean
}

/**
 * Rate limiting middleware for API routes
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await withRateLimit(request, {
 *     usageType: 'questions_asked',
 *     increment: 1
 *   })
 *
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response
 *   }
 *
 *   // Your API logic here
 *   const result = await processRequest()
 *
 *   // Increment usage after successful operation
 *   await rateLimitResult.recordUsage()
 *
 *   return NextResponse.json({ success: true, data: result })
 * }
 * ```
 */
export async function withRateLimit(
  _request: NextRequest,
  options: RateLimitOptions
): Promise<{
  allowed: boolean
  response?: NextResponse
  recordUsage: () => Promise<void>
  userId?: string
  usageStatus?: UsageStatus
}> {
  const { usageType, increment = 1, skipIncrement = false, requireAuth = true } = options

  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (requireAuth && (authError || !user)) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        ),
        recordUsage: async () => {}
      }
    }

    // If auth not required and no user, allow the request
    if (!requireAuth && (!user || authError)) {
      return {
        allowed: true,
        recordUsage: async () => {}
      }
    }

    const userId = user!.id
    const rateLimitService = await createRateLimitService()

    // Check rate limit
    const rateLimitResult = await rateLimitService.checkRateLimit(
      userId,
      usageType,
      increment
    )

    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: rateLimitResult.reason || 'Rate limit exceeded',
            rateLimited: true,
            usageType,
            usageStatus: rateLimitResult.usage
          },
          { status: 429 }
        ),
        recordUsage: async () => {}
      }
    }

    // Return success with usage recording function
    const result: {
      allowed: boolean
      response?: NextResponse
      recordUsage: () => Promise<void>
      userId?: string
      usageStatus?: UsageStatus
    } = {
      allowed: true,
      userId,
      recordUsage: async () => {
        if (!skipIncrement) {
          await rateLimitService.incrementUsage(userId, usageType, increment)
        }
      }
    }
    if (rateLimitResult.usage) {
      result.usageStatus = rateLimitResult.usage
    }
    return result
  } catch (error) {
    console.error('Rate limit middleware error:', error)
    return {
      allowed: false,
      response: NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 500 }
      ),
      recordUsage: async () => {}
    }
  }
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function withRateLimitWrapper(
  usageType: UsageType,
  options: Omit<RateLimitOptions, 'usageType'> = {}
) {
  return function rateLimitDecorator<T extends unknown[], R>(
    handler: (request: NextRequest, ...args: T) => Promise<R>
  ) {
    return async function rateLimitedHandler(
      _request: NextRequest,
      ...args: T
    ): Promise<R | NextResponse> {
      const rateLimitResult = await withRateLimit(_request, {
        usageType,
        ...options
      })

      if (!rateLimitResult.allowed) {
        return rateLimitResult.response!
      }

      try {
  // Execute the original handler
  const result = await handler(_request, ...args)

        // Record usage after successful operation
        await rateLimitResult.recordUsage()

        return result
      } catch (error) {
        // Don't record usage if the operation failed
        throw error
      }
    }
  }
}

/**
 * Middleware to check multiple usage types at once
 */
export async function withMultipleRateLimits(
  _request: NextRequest,
  usageTypes: Array<{ type: UsageType; increment?: number }>
): Promise<{
  allowed: boolean
  response?: NextResponse
  recordUsage: () => Promise<void>
  userId?: string
  usageStatus?: UsageStatus
}> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        ),
        recordUsage: async () => {}
      }
    }

    const rateLimitService = await createRateLimitService()
    const userId = user.id

    // Check all rate limits
    const checks = await Promise.all(
      usageTypes.map(({ type, increment = 1 }) =>
        rateLimitService.checkRateLimit(userId, type, increment)
      )
    )

    // Find the first failed check
    const failedCheck = checks.find(check => !check.allowed)
    if (failedCheck) {
      const failedIndex = checks.indexOf(failedCheck)
      const failedType = usageTypes[failedIndex]?.type || 'unknown'

      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: failedCheck.reason || `Rate limit exceeded for ${failedType}`,
            rateLimited: true,
            usageType: failedType,
            usageStatus: failedCheck.usage
          },
          { status: 429 }
        ),
        recordUsage: async () => {}
      }
    }

    // All checks passed
    const usageStatus = checks[0]?.usage ?? undefined

    const result: {
      allowed: boolean
      response?: NextResponse
      recordUsage: () => Promise<void>
      userId?: string
      usageStatus?: UsageStatus
    } = {
      allowed: true,
      userId,
      recordUsage: async () => {
        // Record all usage types
        await Promise.all(
          usageTypes.map(({ type, increment = 1 }) =>
            rateLimitService.incrementUsage(userId, type, increment)
          )
        )
      }
    }
    if (usageStatus) {
      result.usageStatus = usageStatus
    }
    return result
  } catch (error) {
    console.error('Multiple rate limit middleware error:', error)
    return {
      allowed: false,
      response: NextResponse.json(
        { error: getSafeErrorMessage(error) },
        { status: 500 }
      ),
      recordUsage: async () => {}
    }
  }
}

/**
 * Utility function to add rate limit headers to responses
 */
export function addRateLimitHeaders(
  response: NextResponse,
  usageStatus: UsageStatus,
  usageType: UsageType
): NextResponse {
  const headers = new Headers(response.headers)

  let limit: number
  let remaining: number

  switch (usageType) {
    case 'questions_asked':
      limit = usageStatus.questionsLimit
      remaining = Math.max(0, limit - usageStatus.questionsUsed)
      break
    case 'quiz_questions_generated':
      limit = usageStatus.quizQuestionsLimit
      remaining = Math.max(0, limit - usageStatus.quizQuestionsUsed)
      break
    case 'copilot_interactions':
      limit = usageStatus.copilotInteractionsLimit
      remaining = Math.max(0, limit - usageStatus.copilotInteractionsUsed)
      break
    default:
      return response
  }

  headers.set('X-RateLimit-Limit', limit.toString())
  headers.set('X-RateLimit-Remaining', remaining.toString())
  headers.set('X-RateLimit-Reset', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * Example usage in API routes:
 *
 * // Simple usage
 * export const POST = withRateLimitWrapper('questions_asked')(async (request) => {
 *   // Your API logic here
 *   return NextResponse.json({ success: true })
 * })
 *
 * // Manual usage
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await withRateLimit(request, {
 *     usageType: 'quiz_questions_generated',
 *     increment: 5
 *   })
 *
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response
 *   }
 *
 *   try {
 *     const result = await generateQuizQuestions()
 *     await rateLimitResult.recordUsage()
 *     return NextResponse.json({ success: true, data: result })
 *   } catch (error) {
 *     return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
 *   }
 * }
 */