'use client'

import { logger } from '@/lib/utils/logger'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/services/supabase/client'

export type VoteValue = 1 | -1 | null

interface UseVotingOptions {
  onVoteChange?: (summaryId: string, newScore: number, newVote: VoteValue) => void
  debounceMs?: number
}

interface VoteState {
  isVoting: boolean
  error: string | null
}

/**
 * Hook for managing document voting with anti-spam protection
 *
 * Features:
 * - Prevents spam clicking with debouncing
 * - Ensures one vote per user per document
 * - Optimistic UI updates with rollback on error
 * - Vote caching to reduce API calls
 */
export function useVoting(options: UseVotingOptions = {}) {
  const { onVoteChange, debounceMs = 500 } = options
  const supabase = createClient()

  const [voteStates, setVoteStates] = useState<Record<string, VoteState>>({})
  const pendingVotes = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const voteCache = useRef<Map<string, { vote: VoteValue; score: number }>>(new Map())

  /**
   * Handle voting with debouncing and spam protection
   */
  const handleVote = useCallback(async (
    summaryId: string,
    currentVote: VoteValue,
    currentScore: number,
    newVoteValue: VoteValue,
    userId: string
  ) => {
    // Clear any pending vote for this summary
    const existingTimeout = pendingVotes.current.get(summaryId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Check if already voting on this document
    if (voteStates[summaryId]?.isVoting) {
      return
    }

    // Set voting state
    setVoteStates(prev => ({
      ...prev,
      [summaryId]: { isVoting: true, error: null }
    }))

    // Calculate optimistic updates
    // Ensure currentScore is a valid number (handle null/undefined)
    const validCurrentScore = Number(currentScore) || 0
    let optimisticScore = validCurrentScore
    let optimisticVote: VoteValue = newVoteValue

    if (currentVote === newVoteValue) {
      // Removing vote
      optimisticScore = validCurrentScore - (newVoteValue ?? 0)
      optimisticVote = null
    } else if (currentVote !== null && newVoteValue !== null) {
      // Changing vote
      optimisticScore = validCurrentScore - currentVote + newVoteValue
    } else if (newVoteValue !== null) {
      // Adding new vote
      optimisticScore = validCurrentScore + newVoteValue
    }

    // Ensure score doesn't go below 0 and is a valid number
    optimisticScore = Math.max(0, optimisticScore)
    if (isNaN(optimisticScore)) {
      optimisticScore = 0
    }

    // Store in cache for quick retrieval
    voteCache.current.set(summaryId, { vote: optimisticVote, score: optimisticScore })

    // Optimistic update
    onVoteChange?.(summaryId, optimisticScore, optimisticVote)

    // Debounce the actual API call
    const timeout = setTimeout(async () => {
      try {
        if (currentVote === newVoteValue) {
          // Remove vote
          const { error } = await supabase
            .from('votes')
            .delete()
            .eq('user_id', userId)
            .eq('summary_id', summaryId)

          if (error) throw error
        } else {
          // Upsert vote (insert or update)
          const { error } = await (supabase.from('votes') as any).upsert(
            {
              user_id: userId,
              summary_id: summaryId,
              vote: newVoteValue
            },
            { onConflict: 'user_id,summary_id' }
          )

          if (error) throw error
        }

        // Success - clear voting state
        setVoteStates(prev => ({
          ...prev,
          [summaryId]: { isVoting: false, error: null }
        }))
      } catch (error) {
        logger.error('Vote error', error)

        // Rollback optimistic update
        voteCache.current.delete(summaryId)
        onVoteChange?.(summaryId, currentScore, currentVote)

        // Set error state
        setVoteStates(prev => ({
          ...prev,
          [summaryId]: {
            isVoting: false,
            error: error instanceof Error ? error.message : 'Failed to vote'
          }
        }))
      } finally {
        pendingVotes.current.delete(summaryId)
      }
    }, debounceMs)

    pendingVotes.current.set(summaryId, timeout)
  }, [supabase, onVoteChange, debounceMs, voteStates])

  /**
   * Get cached vote state for a summary
   */
  const getCachedVote = useCallback((summaryId: string) => {
    return voteCache.current.get(summaryId) || null
  }, [])

  /**
   * Clear error for a specific summary
   */
  const clearError = useCallback((summaryId: string) => {
    setVoteStates(prev => ({
      ...prev,
      [summaryId]: { isVoting: false, ...prev[summaryId], error: null }
    }))
  }, [])

  /**
   * Clear all pending votes (useful on unmount)
   */
  const clearPendingVotes = useCallback(() => {
    pendingVotes.current.forEach(timeout => clearTimeout(timeout))
    pendingVotes.current.clear()
  }, [])

  return {
    handleVote,
    voteStates,
    getCachedVote,
    clearError,
    clearPendingVotes
  }
}
