/**
 * GitHub API Key Scraper
 * Searches GitHub for Gemini API keys using intelligent patterns
 */

import type { ScrapedKey } from './types'
import { isValidKeyFormat, delay, createLogger } from './utils'
import { validateGeminiKey } from './validator'
import {
  storeScrapedKeys,
  storeValidationResult,
  storeValidationError
} from './database'
import {
  getAllAvailableGitHubTokens,
  updateGitHubTokenStats,
  type GitHubToken
} from './github-token-manager'

interface ScrapeProgress {
  total: number
  processed: number
  found: number
  duplicates: number
  validated?: number
  validationErrors?: number
  currentSource: string
  startTime: Date
}

type ProgressCallback = (progress: ScrapeProgress) => void

const logger = createLogger('SCRAPER')

class DatabaseGitHubTokenManager {
  private availableTokens: GitHubToken[] = []
  private currentTokenIndex = 0
  private lastTokenRefresh = 0
  private rotationAttempts = 0

  async getCurrentToken(): Promise<string | null> {
    // Refresh token list every 2 minutes or if empty
    const now = Date.now()
    if (
      this.availableTokens.length === 0 ||
      now - this.lastTokenRefresh > 120000
    ) {
      await this.refreshTokens()
    }

    if (this.availableTokens.length === 0) {
      logger.error('[TOKEN] [ERROR] No available GitHub tokens in database!')
      logger.error(
        '[TOKEN] Make sure migration is applied and tokens are initialized'
      )
      return null
    }

    // Get current token
    const currentToken = this.availableTokens[this.currentTokenIndex]
    if (!currentToken) {
      // Reset to first token if index is out of bounds
      this.currentTokenIndex = 0
      return this.availableTokens[0]?.token_value || null
    }

    logger.always(
      `[TOKEN] [ACTIVE] Using token: ${currentToken.token_name} (rate limit: ${currentToken.rate_limit_remaining || 'unknown'}) [${this.currentTokenIndex + 1}/${this.availableTokens.length}]`
    )
    return currentToken.token_value
  }

  async refreshTokens() {
    logger.always('[TOKEN] Refreshing available tokens from database...')
    this.availableTokens = await getAllAvailableGitHubTokens()
    this.lastTokenRefresh = Date.now()
    this.rotationAttempts = 0

    if (this.availableTokens.length > 0) {
      logger.always(
        `[TOKEN] [SUCCESS] Found ${this.availableTokens.length} available token(s)`
      )
      // Reset index to start from the best token (highest rate limit)
      this.currentTokenIndex = 0
    } else {
      logger.warn('[TOKEN] [WARNING] No available tokens found')
    }
  }

  async markCurrentTokenRateLimited(resetAt?: string) {
    if (this.availableTokens.length === 0) return

    const currentToken = this.availableTokens[this.currentTokenIndex]
    if (!currentToken) return

    const resetTime = resetAt || new Date(Date.now() + 3600000).toISOString() // 1 hour default
    await updateGitHubTokenStats(currentToken.id, false, 0, resetTime)
    logger.warn(
      `Token ${currentToken.token_name} rate limited until ${resetTime}`
    )

    // Remove the rate-limited token from available tokens
    this.availableTokens.splice(this.currentTokenIndex, 1)

    // Adjust index if needed
    if (this.currentTokenIndex >= this.availableTokens.length) {
      this.currentTokenIndex = 0
    }

    logger.always(
      `[TOKEN] Removed rate-limited token. ${this.availableTokens.length} tokens remaining`
    )
  }

  async markSuccess(rateLimitRemaining?: number, rateLimitResetAt?: string) {
    if (this.availableTokens.length === 0) return

    const currentToken = this.availableTokens[this.currentTokenIndex]
    if (!currentToken) return

    await updateGitHubTokenStats(
      currentToken.id,
      true,
      rateLimitRemaining,
      rateLimitResetAt
    )

    // Update local token info
    if (rateLimitRemaining !== undefined) {
      currentToken.rate_limit_remaining = rateLimitRemaining
    }
  }

  async rotateToNext() {
    if (this.availableTokens.length <= 1) {
      // If only one token or no tokens, try to refresh
      await this.refreshTokens()
      return
    }

    this.rotationAttempts++

    // Move to next token
    this.currentTokenIndex =
      (this.currentTokenIndex + 1) % this.availableTokens.length

    const nextToken = this.availableTokens[this.currentTokenIndex]
    if (nextToken) {
      logger.always(
        `[TOKEN] Rotated to next token: ${nextToken.token_name} (${this.currentTokenIndex + 1}/${this.availableTokens.length})`
      )
    }

    // If we&apos;ve rotated through all tokens, refresh the list
    if (this.rotationAttempts >= this.availableTokens.length) {
      logger.always('[TOKEN] Rotated through all tokens, refreshing list...')
      await this.refreshTokens()
    }
  }

  getTokenCount(): number {
    return this.availableTokens.length
  }
}

const tokenManager = new DatabaseGitHubTokenManager()

// Enhanced search queries optimized for finding latest Gemini API keys
// Focused on patterns that actually yield results and avoid old/deprecated models
const SEARCH_QUERIES: string[] = [
  // ===== HIGH-YIELD CORE PATTERNS =====
  // Direct API key patterns (most effective)
  'AIzaSy',
  'AIza',

  // Environment variable patterns (very common)
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
  'GEMINI_KEY',
  'GENERATIVE_AI_KEY',

  // ===== LATEST GEMINI MODELS (2.5+) =====
  // Focus on latest models to avoid old/deprecated keys
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-exp-1206',
  'gemini-exp-1121',

  // ===== CURRENT SDK PATTERNS =====
  // Focus on current, actively maintained SDKs
  '@google/generative-ai',
  'GoogleGenerativeAI',
  'generative-ai',
  'google-generativeai',

  // ===== FILE EXTENSION TARGETING =====
  // Target specific file types where keys are commonly leaked
  'AIzaSy extension:env',
  'AIzaSy extension:js',
  'AIzaSy extension:ts',
  'AIzaSy extension:py',
  'AIzaSy extension:json',
  'AIzaSy extension:yaml',
  'AIzaSy extension:yml',
  'AIzaSy extension:txt',
  'GEMINI_API_KEY extension:env',
  'GOOGLE_API_KEY extension:env',

  // ===== FILENAME TARGETING =====
  // Target specific filenames where keys are commonly found
  'AIzaSy filename:.env',
  'AIzaSy filename:config.js',
  'AIzaSy filename:config.ts',
  'AIzaSy filename:settings.json',
  'AIzaSy filename:.env.local',
  'AIzaSy filename:.env.example',
  'GEMINI_API_KEY filename:.env',
  'GOOGLE_API_KEY filename:.env',

  // ===== PATH TARGETING =====
  // Target common paths where config files exist
  'AIzaSy path:config',
  'AIzaSy path:.github',
  'AIzaSy path:src/config',
  'AIzaSy path:lib/config',
  'GEMINI_API_KEY path:config',

  // ===== LANGUAGE-SPECIFIC PATTERNS =====
  // Target specific languages with high adoption
  'GEMINI_API_KEY language:JavaScript',
  'GEMINI_API_KEY language:TypeScript',
  'GEMINI_API_KEY language:Python',
  'AIzaSy language:JavaScript',
  'AIzaSy language:TypeScript',
  'AIzaSy language:Python',

  // ===== CODE USAGE PATTERNS =====
  // Common variable declarations and imports
  'process.env.GEMINI_API_KEY',
  'process.env.GOOGLE_API_KEY',
  'const geminiApiKey',
  'const googleApiKey',
  'import { GoogleGenerativeAI }',
  'new GoogleGenerativeAI(',
  'genai.configure(api_key=',
  'GoogleAI(api_key=',

  // ===== RECENT ACTIVITY FILTERS =====
  // Focus on recently active repositories (more likely to have valid keys)
  'AIzaSy pushed:>2024-11-01',
  'AIzaSy pushed:>2024-12-01',
  'GEMINI_API_KEY pushed:>2024-11-01',
  'GEMINI_API_KEY pushed:>2024-12-01',
  'GoogleGenerativeAI pushed:>2024-11-01',
  '@google/generative-ai pushed:>2024-11-01',

  // ===== REPOSITORY SIZE FILTERS =====
  // Target smaller repos (more likely to have accidentally committed keys)
  'AIzaSy size:<1000',
  'GEMINI_API_KEY size:<1000',
  'AIzaSy size:<5000',
  'GEMINI_API_KEY size:<5000',

  // ===== COMBINED PATTERNS =====
  // High-precision combined searches
  'AIzaSy GoogleGenerativeAI',
  'GEMINI_API_KEY @google/generative-ai',
  'AIzaSy gemini-1.5-pro',
  'GEMINI_API_KEY gemini-1.5-flash',
  'process.env.GEMINI_API_KEY @google/generative-ai',

  // ===== TUTORIAL/EXAMPLE PATTERNS =====
  // Educational content often contains working keys
  'AIzaSy tutorial',
  'AIzaSy example',
  'GEMINI_API_KEY tutorial',
  'GEMINI_API_KEY example',
  'gemini api key tutorial',

  // ===== DEPLOYMENT PATTERNS =====
  // Keys in deployment configs
  'AIzaSy docker-compose',
  'AIzaSy Dockerfile',
  'GEMINI_API_KEY docker',
  'AIzaSy vercel',
  'AIzaSy netlify',

  // ===== TESTING PATTERNS =====
  // Test files often contain real keys
  'AIzaSy filename:test',
  'GEMINI_API_KEY filename:test',
  'AIzaSy path:test',
  'AIzaSy path:tests',

  // ===== DOCUMENTATION PATTERNS =====
  // README and docs sometimes contain keys
  'AIzaSy filename:README',
  'GEMINI_API_KEY filename:README',
  'AIzaSy path:docs',
  'GEMINI_API_KEY path:docs'
]

// Generate time-based search queries for fresh content
function generateTimeBasedQueries(): string[] {
  const queries = []
  const now = new Date()

  // Search for content from the last few months
  for (let monthsBack = 1; monthsBack <= 6; monthsBack++) {
    const date = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    const dateStr = date.toISOString().split('T')[0]

    queries.push(
      `AIzaSy pushed:>${dateStr}`,
      `GEMINI_API_KEY pushed:>${dateStr}`,
      `GoogleGenerativeAI pushed:>${dateStr}`
    )
  }

  return queries
}

// Get all search queries including time-based ones
function getAllSearchQueries(): string[] {
  return [...SEARCH_QUERIES, ...generateTimeBasedQueries()]
}

const KEY_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/g,
  /AIza[A-Za-z0-9_-]{35}/g,
  /AIza[A-Za-z0-9_\-]{33,39}/g
]

/**
 * Enhanced GitHub Code Search for API Keys
 * Optimized for maximum yield with sophisticated pagination and multi-page scraping
 */
export async function scrapeGitHubKeys(
  limit = 100,
  onProgress?: ProgressCallback,
  options?: {
    validateKeys?: boolean
    storeInDatabase?: boolean
    startQueryIndex?: number // For query rotation between calls
    existingKeys?: Set<string> // Keys to skip (already in database)
  }
): Promise<ScrapedKey[]> {
  const results: ScrapedKey[] = []

  // Use provided existingKeys or create new Set
  const seenKeys = options?.existingKeys || new Set<string>()

  // Get all available search queries (including time-based ones)
  const allQueries = getAllSearchQueries()

  // Rotate starting query to get different results each time
  const startIdx =
    options?.startQueryIndex ?? Math.floor(Math.random() * allQueries.length)

  // Create rotated query list
  const rotatedQueries = [
    ...allQueries.slice(startIdx),
    ...allQueries.slice(0, startIdx)
  ]

  logger.always(
    `[SCRAPE] Starting enhanced GitHub search with ${rotatedQueries.length} queries, ${seenKeys.size} existing keys to skip`
  )

  const getHeaders = async (): Promise<HeadersInit> => {
    const token = await tokenManager.getCurrentToken()
    return {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FrogBytes-KeyScraper',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  }

  const progress: ScrapeProgress = {
    total: rotatedQueries.length,
    processed: 0,
    found: 0,
    duplicates: 0,
    validated: 0,
    validationErrors: 0,
    currentSource: 'github-code-enhanced',
    startTime: new Date()
  }

  logger.always(
    `[SCRAPE] Starting enhanced GitHub search with ${rotatedQueries.length} queries (rotated from index ${startIdx})`
  )

  for (
    let queryIdx = 0;
    queryIdx < rotatedQueries.length && results.length < limit;
    queryIdx++
  ) {
    const query = rotatedQueries[queryIdx]
    if (!query) continue // Skip if query is undefined

    progress.processed = queryIdx + 1
    progress.currentSource = `github-enhanced: ${query.substring(0, 30)}...`
    onProgress?.(progress)

    logger.always(
      `[GITHUB-ENHANCED] Query ${queryIdx + 1}/${rotatedQueries.length}: "${query}"`
    )

    try {
      // Enhanced pagination strategy: fetch multiple pages per query
      const maxPagesPerQuery = 3 // Increased from 1 to 3
      const perPage = 100 // Increased from 50 to 100 (GitHub max)

      for (
        let page = 1;
        page <= maxPagesPerQuery && results.length < limit;
        page++
      ) {
        // Vary sort parameter for diversity
        const sortOptions = ['indexed', 'updated']
        const sortParam = sortOptions[page % 2] // Alternate between indexed and updated

        logger.always(
          `[GITHUB-ENHANCED] Fetching page ${page}/${maxPagesPerQuery} (sort=${sortParam}, per_page=${perPage})...`
        )

        const response = await fetch(
          `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&sort=${sortParam}&order=desc`,
          { headers: await getHeaders() }
        )

        logger.always(
          `[GITHUB-ENHANCED] Response status: ${response.status} ${response.statusText}`
        )

        // Extract rate limit info from headers
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')
        const rateLimitReset = response.headers.get('x-ratelimit-reset')
        const rateLimitResetDate = rateLimitReset
          ? new Date(parseInt(rateLimitReset) * 1000).toISOString()
          : undefined

        if (!response.ok) {
          if (response.status === 403 || response.status === 429) {
            await tokenManager.markCurrentTokenRateLimited(rateLimitResetDate)

            // Check if we have more tokens available
            const tokenCount = tokenManager.getTokenCount()
            if (tokenCount > 0) {
              await tokenManager.rotateToNext()
              logger.warn(
                `Rate limited, rotating to next token (${tokenCount} tokens remaining)`
              )
              page-- // Retry same page with new token
              await delay(1000) // Short delay before retry
              continue
            } else {
              logger.error('All tokens are rate limited! Waiting 60 seconds...')
              await delay(60000) // Wait a minute before trying again
              await tokenManager.refreshTokens() // Refresh token list
              if (tokenManager.getTokenCount() > 0) {
                page-- // Retry page
                continue
              } else {
                logger.error('No tokens available after refresh, ending scrape')
                break
              }
            }
          }
          logger.error(
            `GitHub API error: ${response.status} ${response.statusText}`
          )
          break // Break page loop for this query
        }

        // Update token stats on success
        await tokenManager.markSuccess(
          rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
          rateLimitResetDate
        )

        // Check if rate limit is getting low and proactively rotate
        const remaining = rateLimitRemaining
          ? parseInt(rateLimitRemaining)
          : null
        if (
          remaining !== null &&
          remaining < 10 &&
          tokenManager.getTokenCount() > 1
        ) {
          logger.always(
            `[TOKEN] Rate limit low (${remaining}), proactively rotating to preserve token`
          )
          await tokenManager.rotateToNext()
        }

        const data = await response.json()
        logger.always(
          `[GITHUB-ENHANCED] Page ${page}: Found ${data.items?.length || 0} code results`
        )

        // If no results on this page, stop pagination for this query
        if (!data.items || data.items.length === 0) {
          logger.always(
            `[GITHUB-ENHANCED] No more results for query "${query}", stopping pagination`
          )
          break
        }

        // Process all items from this page
        for (const item of data.items || []) {
          if (results.length >= limit) break

          try {
            const rawUrl = item.html_url
              .replace('github.com', 'raw.githubusercontent.com')
              .replace('/blob/', '/')

            logger.always(
              `[GITHUB-ENHANCED] Scanning file: ${item.repository?.full_name}/${item.name}`
            )

            // Add timeout for file fetching
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

            const contentResponse = await fetch(rawUrl, {
              signal: controller.signal
            })
            clearTimeout(timeoutId)

            if (!contentResponse.ok) {
              logger.warn(
                `[GITHUB-ENHANCED] Could not fetch ${item.name}: ${contentResponse.status}`
              )
              continue
            }

            const content = await contentResponse.text()

            // Enhanced content size limit to avoid processing huge files
            if (content.length > 500000) {
              // 500KB limit
              logger.warn(
                `[GITHUB-ENHANCED] Skipping large file ${item.name} (${content.length} bytes)`
              )
              continue
            }

            const foundKeys = new Set<string>()

            for (const pattern of KEY_PATTERNS) {
              const matches = content.match(pattern)
              if (matches) {
                logger.always(
                  `[GITHUB-ENHANCED] Found ${matches.length} potential keys in ${item.name}`
                )
                for (const key of matches) {
                  if (isValidKeyFormat(key)) {
                    foundKeys.add(key)
                    logger.always(
                      `[GITHUB-ENHANCED] Valid key format: ${key.substring(0, 12)}...`
                    )
                  }
                }
              }
            }

            for (const key of Array.from(foundKeys)) {
              if (seenKeys.has(key)) {
                progress.duplicates++
                logger.always(
                  `[GITHUB-ENHANCED] Duplicate key: ${key.substring(0, 12)}...`
                )
                continue
              }

              seenKeys.add(key)
              progress.found++

              logger.always(
                `[GITHUB-ENHANCED] [NEW] Key found: ${key.substring(0, 12)}... from ${item.repository?.full_name}`
              )

              results.push({
                key,
                sourceUrl: item.html_url,
                source: 'github',
                foundAt: new Date(),
                metadata: {
                  filename: item.name,
                  repository: item.repository?.full_name,
                  language: item.language,
                  lastModified: item.repository?.updated_at
                }
              })
            }
          } catch (error: any) {
            if (error.name !== 'AbortError') {
              logger.error(
                `[GITHUB-ENHANCED] Error fetching file: ${error.message}`
              )
            }
          }

          await delay(200) // Reduced delay between files
        }

        // Small delay between pages
        await delay(500)
      }

      // Delay between queries
      await delay(1000)
    } catch (error) {
      logger.error(`Error in enhanced GitHub search: ${error}`)
    }
  }

  logger.always(
    `[SCRAPE] Enhanced GitHub code search complete: Found ${results.length} new keys`
  )

  // Store scraped keys in database if requested
  if (options?.storeInDatabase && results.length > 0) {
    try {
      logger.always(
        `[DB] Storing ${results.length} keys to 'potential_keys' table...`
      )
      await storeScrapedKeys(results)
      logger.always(
        `[DB] [SUCCESS] Successfully stored ${results.length} keys to database`
      )
    } catch (error: any) {
      logger.error(
        `[DB] [ERROR] Failed to store scraped keys: ${error.message}`
      )
    }
  } else if (results.length > 0) {
    logger.always(`[DB] Skipping database storage (storeInDatabase=false)`)
  }

  // Validate keys if requested
  if (options?.validateKeys && results.length > 0) {
    logger.always(`Starting validation of ${results.length} scraped keys`)

    for (const result of results) {
      try {
        progress.currentSource = `Validating key: ${result.key.substring(0, 12)}...`
        onProgress?.(progress)

        const validationResult = await validateGeminiKey(result.key)

        // Store validation result if storing in database
        if (options.storeInDatabase) {
          await storeValidationResult(validationResult)
        }

        progress.validated = (progress.validated || 0) + 1
        logger.always(
          `Key validation complete: ${validationResult.totalModelsAccessible}/${validationResult.totalModelsTested} models accessible`
        )

        // Delay between validations to avoid rate limiting
        await delay(1000)
      } catch (error) {
        logger.error(
          `Failed to validate key ${result.key.substring(0, 12)}...: ${error}`
        )

        if (options.storeInDatabase) {
          try {
            await storeValidationError(result.key, String(error))
          } catch (storeError) {
            logger.error(`Failed to store validation error: ${storeError}`)
          }
        }

        progress.validationErrors = (progress.validationErrors || 0) + 1
      }
    }

    logger.always(
      `Validation complete: ${progress.validated}/${results.length} keys validated successfully`
    )
  }

  return results
}

/**
 * Enhanced scraping from GitHub code search only
 * Removes GitHub Gist functionality for better performance and focus
 */
export async function scrapeAllSources(
  limit = 200,
  onProgress?: ProgressCallback,
  options?: {
    validateKeys?: boolean
    storeInDatabase?: boolean
    logger?: any
  }
): Promise<ScrapedKey[]> {
  const results: ScrapedKey[] = []
  const seenKeys = new Set<string>()

  const dbLogger = options?.logger

  logger.always(
    `Starting enhanced scrape (GitHub code only) with limit: ${limit}`
  )
  await dbLogger?.info(`Starting enhanced scrape with limit: ${limit}`)

  // Use full limit for GitHub since we're not using Gist anymore
  const githubLimit = limit

  await dbLogger?.info(
    `Searching enhanced GitHub code with limit: ${githubLimit}`
  )

  // Enhanced GitHub search with multiple strategies
  const githubKeys = await scrapeGitHubKeys(githubLimit, onProgress, {
    validateKeys: false,
    storeInDatabase: false
  })

  await dbLogger?.info(
    `Found ${githubKeys.length} keys from enhanced GitHub search`,
    {
      found: githubKeys.length
    }
  )

  githubKeys.forEach(key => {
    if (!seenKeys.has(key.key)) {
      seenKeys.add(key.key)
      results.push(key)
    }
  })

  logger.always(
    `[SCRAPE-ENHANCED] Total keys collected from enhanced GitHub search: ${results.length}`
  )

  // Store and validate all collected keys at the end
  if (options?.storeInDatabase && results.length > 0) {
    try {
      logger.always(`[DB] Storing ${results.length} keys to database...`)
      await dbLogger?.info(`Storing ${results.length} keys in database`)
      await storeScrapedKeys(results)
      logger.always(
        `[DB] [SUCCESS] Successfully stored ${results.length} keys to 'potential_keys' table`
      )
      await dbLogger?.success(`Stored ${results.length} keys in database`, {
        stored: results.length,
        unique: results.length
      })
    } catch (error: any) {
      logger.error(
        `[DB] [ERROR] Failed to store scraped keys: ${error.message}`
      )
      logger.error(`[DB] Stack: ${error.stack}`)
      await dbLogger?.error(`Failed to store keys: ${error.message}`)
    }
  } else if (results.length > 0) {
    logger.always(
      `[DB] Skipping database storage (storeInDatabase=${options?.storeInDatabase})`
    )
  }

  if (options?.validateKeys && results.length > 0) {
    logger.always(`Starting validation of ${results.length} scraped keys`)
    await dbLogger?.info(`Starting validation of ${results.length} keys`)

    let validCount = 0
    let invalidCount = 0

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (!result?.key) continue // Skip if result or key is invalid

      const keyPreview = result.key.substring(0, 12)

      try {
        onProgress?.({
          total: results.length,
          processed: i + 1,
          found: results.length,
          duplicates: 0,
          validated: i,
          validationErrors: 0,
          currentSource: `Validating key ${i + 1}/${results.length}: ${keyPreview}...`,
          startTime: new Date()
        })

        await dbLogger?.info(`Validating key ${i + 1}/${results.length}`, {
          keyPreview: keyPreview + '...',
          progress: `${i + 1}/${results.length}`
        })

        const validationResult = await validateGeminiKey(result.key)

        // Store validation result if storing in database
        if (options.storeInDatabase) {
          await storeValidationResult(validationResult)
        }

        if (validationResult.isValid) {
          validCount++
          await dbLogger?.success(
            `Key ${i + 1}/${results.length} is valid: ${validationResult.totalModelsAccessible}/${validationResult.totalModelsTested} models`,
            {
              keyPreview: keyPreview + '...',
              modelsAccessible: validationResult.totalModelsAccessible,
              modelsTested: validationResult.totalModelsTested
            }
          )
        } else {
          invalidCount++
          await dbLogger?.warn(`Key ${i + 1}/${results.length} is invalid`, {
            keyPreview: keyPreview + '...'
          })
        }

        logger.always(
          `Key ${i + 1}/${results.length} validation complete: ${validationResult.totalModelsAccessible}/${validationResult.totalModelsTested} models accessible`
        )

        // Delay between validations to avoid rate limiting
        await delay(1000)
      } catch (error) {
        invalidCount++
        logger.error(`Failed to validate key ${keyPreview}...: ${error}`)
        await dbLogger?.error(
          `Failed to validate key ${i + 1}/${results.length}`,
          {
            keyPreview: keyPreview + '...',
            error: String(error)
          }
        )

        if (options.storeInDatabase) {
          try {
            await storeValidationError(result.key, String(error))
          } catch (storeError) {
            logger.error(`Failed to store validation error: ${storeError}`)
          }
        }
      }
    }

    logger.always(`Validation complete for all scraped keys`)
    await dbLogger?.success(`Validation complete`, {
      total: results.length,
      valid: validCount,
      invalid: invalidCount
    })
  }

  logger.always(
    `Enhanced scraping complete: ${results.length} unique keys found`
  )
  return results
}

/**
 * Bulk scrape with validation - for API endpoints
 */
export async function bulkScrapeWithValidation(options: {
  targetKeys?: number
  limit?: number
  maxDuration?: number
  concurrentValidation?: number | boolean
  validateKeys?: boolean
  onProgress?: ProgressCallback
  onValidated?: (key: string, valid: boolean) => void
}): Promise<{
  scraped: ScrapedKey[]
  validated?: Map<string, boolean>
  stats: {
    totalScraped: number
    totalValidated?: number
    validKeys?: number
    invalidKeys?: number
    quotaExceeded?: number
  }
  statistics: {
    totalScraped: number
    validKeys: number
    invalidKeys: number
    quotaExceeded: number
  }
  duration: number
}> {
  const startTime = Date.now()
  const limit = options.limit || options.targetKeys || 100
  const shouldValidate =
    options.validateKeys ||
    (typeof options.concurrentValidation === 'boolean'
      ? options.concurrentValidation
      : typeof options.concurrentValidation === 'number' &&
        options.concurrentValidation > 0)

  // Scrape keys
  const scrapedKeys = await scrapeGitHubKeys(limit, options.onProgress, {
    validateKeys: shouldValidate,
    storeInDatabase: true
  })

  const duration = Date.now() - startTime
  const stats = {
    totalScraped: scrapedKeys.length,
    validKeys: 0,
    invalidKeys: 0,
    quotaExceeded: 0
  }

  const result = {
    scraped: scrapedKeys,
    validated: new Map<string, boolean>(),
    stats,
    statistics: stats,
    duration
  }

  return result
}
