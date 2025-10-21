import { createClient } from '@/services/supabase/server'
import { DatabaseError, AuthenticationError } from '@/lib/utils/errors'
import type { Database } from '@/services/supabase/database.types'

export type UsageType = 'questions_asked' | 'quiz_questions_generated' | 'copilot_interactions'

export interface UserUsageStatus {
  currentTier: 'free' | 'unlimited'
  tierExpiresAt: string | null
  questionsUsed: number
  questionsLimit: number
  quizQuestionsUsed: number
  quizQuestionsLimit: number
  copilotInteractionsUsed: number
  copilotInteractionsLimit: number
  successfulInvitations: number
}

export interface RateLimitResult {
  allowed: boolean
  usage?: UserUsageStatus
  reason?: string
}

export class RateLimitService {
  private supabase: Awaited<ReturnType<typeof createClient>>

  constructor(supabaseClient: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabaseClient
  }

  /**
   * Check if user can perform an action without incrementing usage
   */
  async checkRateLimit(
    userId: string,
    usageType: UsageType,
    incrementAmount: number = 1
  ): Promise<RateLimitResult> {
    try {
      const rpcRes: any = await this.supabase.rpc('check_rate_limit', {
        user_id_param: userId,
        usage_type: usageType,
        increment_amount: incrementAmount
      } as any)
      const { data, error } = rpcRes

      if (error) {
        throw new DatabaseError(
          `Failed to check rate limit: ${error.message}`,
          'rpc',
          'check_rate_limit'
        )
      }

  const usage = await this.getUserUsageStatus(userId)

  const res: RateLimitResult = { allowed: Boolean(data), usage }
      if (data === false) res.reason = `Daily limit exceeded for ${usageType}`
      return res
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error checking rate limit',
        'rpc',
        'check_rate_limit'
      )
    }
  }

  /**
   * Increment usage counter if within limits
   */
  async incrementUsage(
    userId: string,
    usageType: UsageType,
    incrementAmount: number = 1
  ): Promise<RateLimitResult> {
    try {
      const rpcRes2: any = await this.supabase.rpc('increment_usage', {
        user_id_param: userId,
        usage_type: usageType,
        increment_amount: incrementAmount
      } as any)
      const { data, error } = rpcRes2

      if (error) {
        throw new DatabaseError(
          `Failed to increment usage: ${error.message}`,
          'rpc',
          'increment_usage'
        )
      }

  const usage = await this.getUserUsageStatus(userId)

  const res: RateLimitResult = { allowed: Boolean(data), usage }
      if (data === false) res.reason = `Daily limit exceeded for ${usageType}`
      return res
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error incrementing usage',
        'rpc',
        'increment_usage'
      )
    }
  }

  /**
   * Get user's current usage status and limits
   */
  async getUserUsageStatus(userId: string): Promise<UserUsageStatus> {
    try {
      const rpcRes3: any = await this.supabase.rpc('get_user_usage_status', {
        user_id_param: userId
      } as any)
      const { data, error } = rpcRes3

      if (error) {
        throw new DatabaseError(
          `Failed to get usage status: ${error.message}`,
          'rpc',
          'get_user_usage_status'
        )
      }

      if (!data || data.length === 0) {
        throw new DatabaseError(
          'No usage data found for user',
          'rpc',
          'get_user_usage_status'
        )
      }

      const usage = data[0]
      return {
        currentTier: usage.current_tier,
        tierExpiresAt: usage.tier_expires_at,
        questionsUsed: usage.questions_used,
        questionsLimit: usage.questions_limit,
        quizQuestionsUsed: usage.quiz_questions_used,
        quizQuestionsLimit: usage.quiz_questions_limit,
        copilotInteractionsUsed: usage.copilot_interactions_used,
        copilotInteractionsLimit: usage.copilot_interactions_limit,
        successfulInvitations: usage.successful_invitations
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error getting usage status',
        'rpc',
        'get_user_usage_status'
      )
    }
  }

  /**
   * Check if user can ask questions (helper method)
   */
  async canAskQuestions(userId: string, count: number = 1): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'questions_asked', count)
  }

  /**
   * Check if user can generate quiz questions (helper method)
   */
  async canGenerateQuizQuestions(userId: string, count: number = 1): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'quiz_questions_generated', count)
  }

  /**
   * Check if user can use copilot (helper method)
   */
  async canUseCopilot(userId: string, count: number = 1): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'copilot_interactions', count)
  }

  /**
   * Record question asked (helper method)
   */
  async recordQuestionAsked(userId: string, count: number = 1): Promise<RateLimitResult> {
    return this.incrementUsage(userId, 'questions_asked', count)
  }

  /**
   * Record quiz questions generated (helper method)
   */
  async recordQuizQuestionsGenerated(userId: string, count: number = 1): Promise<RateLimitResult> {
    return this.incrementUsage(userId, 'quiz_questions_generated', count)
  }

  /**
   * Record copilot interaction (helper method)
   */
  async recordCopilotInteraction(userId: string, count: number = 1): Promise<RateLimitResult> {
    return this.incrementUsage(userId, 'copilot_interactions', count)
  }

  /**
   * Get usage percentage for display
   */
  getUsagePercentage(used: number, limit: number): number {
    if (limit === 0) return 0
    if (limit >= 999999) return 0 // Unlimited tier
    return Math.min(100, (used / limit) * 100)
  }

  /**
   * Check if user is close to limit (>80%)
   */
  isNearLimit(used: number, limit: number): boolean {
    return this.getUsagePercentage(used, limit) > 80
  }

  /**
   * Get time until reset (always daily at midnight)
   */
  getTimeUntilReset(): string {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    const diff = tomorrow.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${hours}h ${minutes}m`
  }
}

/**
 * Factory function to create rate limit service with server client
 */
export async function createRateLimitService(): Promise<RateLimitService> {
  const supabase = await createClient()
  return new RateLimitService(supabase)
}

/**
 * Middleware function to check authentication and rate limits
 */
export async function withRateLimit<T>(
  userId: string | null,
  usageType: UsageType,
  operation: (rateLimitService: RateLimitService) => Promise<T>
): Promise<T> {
  if (!userId) {
    throw new AuthenticationError('User must be authenticated')
  }

  const rateLimitService = await createRateLimitService()

  // Check rate limit before operation
  const rateLimitResult = await rateLimitService.checkRateLimit(userId, usageType)

  if (!rateLimitResult.allowed) {
    throw new Error(rateLimitResult.reason ?? 'Daily usage limit exceeded. Please try again tomorrow or upgrade your account')
  }

  // Perform operation
  const result = await operation(rateLimitService)

  // Increment usage after successful operation
  await rateLimitService.incrementUsage(userId, usageType)

  return result
}

export type { Database }