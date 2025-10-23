import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'
import { createRateLimitService } from '@/lib/services/rate-limit-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/user/usage
 * Get current user's usage status and limits
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitService = await createRateLimitService()
    const usageStatus = await rateLimitService.getUserUsageStatus(user.id)

    return NextResponse.json({
      success: true,
      data: {
        ...usageStatus,
        timeUntilReset: rateLimitService.getTimeUntilReset(),
        questionsPercentage: rateLimitService.getUsagePercentage(
          usageStatus.questionsUsed,
          usageStatus.questionsLimit
        ),
        quizQuestionsPercentage: rateLimitService.getUsagePercentage(
          usageStatus.quizQuestionsUsed,
          usageStatus.quizQuestionsLimit
        ),
        copilotInteractionsPercentage: rateLimitService.getUsagePercentage(
          usageStatus.copilotInteractionsUsed,
          usageStatus.copilotInteractionsLimit
        ),
        isNearQuestionsLimit: rateLimitService.isNearLimit(
          usageStatus.questionsUsed,
          usageStatus.questionsLimit
        ),
        isNearQuizQuestionsLimit: rateLimitService.isNearLimit(
          usageStatus.quizQuestionsUsed,
          usageStatus.quizQuestionsLimit
        ),
        isNearCopilotLimit: rateLimitService.isNearLimit(
          usageStatus.copilotInteractionsUsed,
          usageStatus.copilotInteractionsLimit
        )
      }
    })
  } catch (error) {
    logger.error('Error fetching user usage', error)
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/usage
 * Record usage for a specific type
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { usageType, count = 1 } = body

    if (
      !usageType ||
      ![
        'questions_asked',
        'quiz_questions_generated',
        'copilot_interactions'
      ].includes(usageType)
    ) {
      return NextResponse.json({ error: 'Invalid usage type' }, { status: 400 })
    }

    if (typeof count !== 'number' || count < 1 || count > 100) {
      return NextResponse.json(
        { error: 'Count must be a number between 1 and 100' },
        { status: 400 }
      )
    }

    const rateLimitService = await createRateLimitService()
    const result = await rateLimitService.incrementUsage(
      user.id,
      usageType,
      count
    )

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: result.reason,
          data: result.usage
        },
        { status: 429 } // Too Many Requests
      )
    }

    return NextResponse.json({
      success: true,
      data: result.usage
    })
  } catch (error) {
    logger.error('Error recording usage', error)
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
