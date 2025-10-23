/**
 * Retry Utility with Automatic Key Rotation
 *
 * Provides robust retry logic for Gemini API calls with:
 * - Automatic key rotation from database pool
 * - Exponential backoff
 * - Error classification and key marking
 * - Seamless user experience (transparent retries)
 *
 * Usage:
 * ```typescript
 * const result = await retryWithKeyRotation(async (apiKey) => {
 *   const response = await fetch(`${API_URL}?key=${apiKey}`, options)
 *   if (!response.ok) throw new Error('API error')
 *   return response.json()
 * })
 * ```
 */

import {
  getKeyForTextGeneration,
  markKeyQuotaExceeded,
  markKeyInvalid,
  markKeySuccess
} from './key-pool-service'
import { createLogger } from './utils'

const logger = createLogger('RETRY-FALLBACK')

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  exponentialBase?: number
  onRetry?: (attempt: number, error: Error, nextKey: string) => void
}

export interface RetryError extends Error {
  attempts: number
  lastError: Error
  exhaustedKeys: boolean
}

/**
 * Classify error to determine if key should be marked
 */
function classifyError(error: Error | string): {
  isQuotaError: boolean
  isInvalidKeyError: boolean
  isRetryable: boolean
} {
  const errorText = typeof error === 'string' ? error : error.message
  const lowerError = errorText.toLowerCase()

  const isQuotaError =
    lowerError.includes('quota') ||
    lowerError.includes('limit') ||
    lowerError.includes('rate limit') ||
    lowerError.includes('429')

  const isInvalidKeyError =
    (lowerError.includes('invalid') && lowerError.includes('key')) ||
    lowerError.includes('api key') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('401') ||
    lowerError.includes('403')

  const isRetryable = isQuotaError || isInvalidKeyError

  return { isQuotaError, isInvalidKeyError, isRetryable }
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  base: number
): number {
  const exponentialDelay = initialDelay * Math.pow(base, attempt)
  const cappedDelay = Math.min(exponentialDelay, maxDelay)
  // Add jitter (±20%) to prevent thundering herd
  const jitter = cappedDelay * 0.2 * (Math.random() - 0.5)
  return Math.floor(cappedDelay + jitter)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry an API call with automatic key rotation
 *
 * @param apiCall - Function that takes an API key and makes the request
 * @param options - Retry configuration options
 * @returns The result of the successful API call
 * @throws RetryError if all retries are exhausted
 */
export async function retryWithKeyRotation<T>(
  apiCall: (apiKey: string) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 5,
    initialDelayMs = 300,
    maxDelayMs = 10000,
    exponentialBase = 2,
    onRetry
  } = options

  let lastError: Error | null = null
  const usedKeys = new Set<string>()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Get a fresh key from the pool
    const apiKey = await getKeyForTextGeneration()

    if (!apiKey) {
      const noKeysError = new Error('No API keys available in pool')
      const error = noKeysError as RetryError
      error.attempts = attempt
      error.lastError = lastError || noKeysError
      error.exhaustedKeys = true
      throw error
    }

    // Skip if we&apos;ve already tried this key
    if (usedKeys.has(apiKey)) {
      logger.warn(
        `Key already tried, fetching another... (attempt ${attempt + 1}/${maxRetries + 1})`
      )

      // If we&apos;ve exhausted unique keys, wait before retry
      if (usedKeys.size >= 3) {
        const delay = calculateBackoff(
          attempt,
          initialDelayMs,
          maxDelayMs,
          exponentialBase
        )
        await sleep(delay)
      }

      continue
    }

    usedKeys.add(apiKey)

    try {
      logger.info(
        `Attempting API call with key ${apiKey.substring(0, 12)}... (attempt ${attempt + 1}/${maxRetries + 1})`
      )

      const result = await apiCall(apiKey)

      // Success! Mark key and return
      await markKeySuccess(apiKey)
      logger.info(`API call succeeded on attempt ${attempt + 1}`)

      return result
    } catch (error: any) {
      lastError = error

      // Extract error message from response if available
      let errorMessage = error.message
      if (error.responseText) {
        errorMessage = error.responseText
      }

      const classification = classifyError(errorMessage)

      logger.warn(
        `API call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${errorMessage}`
      )

      // Mark key based on error type
      if (classification.isQuotaError) {
        logger.warn(
          `Quota exceeded for key ${apiKey.substring(0, 12)}..., marking and rotating`
        )
        await markKeyQuotaExceeded(apiKey)
      } else if (classification.isInvalidKeyError) {
        logger.warn(
          `Invalid key ${apiKey.substring(0, 12)}..., marking and removing from pool`
        )
        await markKeyInvalid(apiKey, errorMessage)
      } else {
        // Unknown error - log but don&apos;t mark key as bad
        logger.error(`Unknown error type: ${errorMessage}`)
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        const finalError = new Error(
          `API call failed after ${maxRetries + 1} attempts: ${errorMessage}`
        )
        const retryError = finalError as RetryError
        retryError.attempts = attempt + 1
        retryError.lastError = lastError || finalError
        retryError.exhaustedKeys = usedKeys.size >= maxRetries
        throw retryError
      }

      // Calculate backoff delay
      const delay = calculateBackoff(
        attempt,
        initialDelayMs,
        maxDelayMs,
        exponentialBase
      )

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, apiKey)
      }

      logger.info(`Waiting ${delay}ms before next retry...`)
      await sleep(delay)
    }
  }

  // Should never reach here, but TypeScript needs it
  const unexpectedError = new Error('Unexpected retry loop exit')
  const error = unexpectedError as RetryError
  error.attempts = maxRetries + 1
  error.lastError = lastError || unexpectedError
  error.exhaustedKeys = true
  throw error
}

/**
 * Specialized retry for streaming responses
 * Returns { stream, apiKey } on success so caller can handle streaming
 *
 * @param apiCall - Function that returns a streaming response
 * @param options - Retry configuration
 * @returns Object with stream and the successful API key
 */
export async function retryStreamWithKeyRotation<T extends Response>(
  apiCall: (apiKey: string) => Promise<T>,
  options: RetryOptions = {}
): Promise<{ response: T; apiKey: string }> {
  const {
    maxRetries = 5,
    initialDelayMs = 300,
    maxDelayMs = 10000,
    exponentialBase = 2,
    onRetry
  } = options

  let lastError: Error | null = null
  const usedKeys = new Set<string>()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const apiKey = await getKeyForTextGeneration()

    if (!apiKey) {
      const noKeysError = new Error('No API keys available in pool')
      const error = noKeysError as RetryError
      error.attempts = attempt
      error.lastError = lastError || noKeysError
      error.exhaustedKeys = true
      throw error
    }

    if (usedKeys.has(apiKey)) {
      logger.warn(
        `Key already tried, fetching another... (attempt ${attempt + 1}/${maxRetries + 1})`
      )

      if (usedKeys.size >= 3) {
        const delay = calculateBackoff(
          attempt,
          initialDelayMs,
          maxDelayMs,
          exponentialBase
        )
        await sleep(delay)
      }

      continue
    }

    usedKeys.add(apiKey)

    try {
      logger.info(
        `Attempting streaming API call with key ${apiKey.substring(0, 12)}... (attempt ${attempt + 1}/${maxRetries + 1})`
      )

      const response = await apiCall(apiKey)

      // Check if response is OK before marking success
      if (!response.ok) {
        const errorText = await response.text()
        const error: any = new Error(
          `HTTP ${response.status}: ${response.statusText}`
        )
        error.responseText = errorText
        throw error
      }

      // Mark success and return both response and key
      await markKeySuccess(apiKey)
      logger.info(`Streaming API call succeeded on attempt ${attempt + 1}`)

      return { response, apiKey }
    } catch (error: any) {
      lastError = error

      let errorMessage = error.message
      if (error.responseText) {
        errorMessage = error.responseText
      }

      const classification = classifyError(errorMessage)

      logger.warn(
        `Streaming API call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${errorMessage}`
      )

      if (classification.isQuotaError) {
        await markKeyQuotaExceeded(apiKey)
      } else if (classification.isInvalidKeyError) {
        await markKeyInvalid(apiKey, errorMessage)
      }

      if (attempt === maxRetries) {
        const finalError = new Error(
          `Streaming API call failed after ${maxRetries + 1} attempts: ${errorMessage}`
        )
        const retryError = finalError as RetryError
        retryError.attempts = attempt + 1
        retryError.lastError = lastError || finalError
        retryError.exhaustedKeys = usedKeys.size >= maxRetries
        throw retryError
      }

      const delay = calculateBackoff(
        attempt,
        initialDelayMs,
        maxDelayMs,
        exponentialBase
      )

      if (onRetry) {
        onRetry(attempt + 1, error, apiKey)
      }

      logger.info(`Waiting ${delay}ms before next retry...`)
      await sleep(delay)
    }
  }

  const error = new Error('Unexpected retry loop exit') as RetryError
  error.attempts = maxRetries + 1
  error.lastError = lastError || error
  error.exhaustedKeys = true
  throw error
}
