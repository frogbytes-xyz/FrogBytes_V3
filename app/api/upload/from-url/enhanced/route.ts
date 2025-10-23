import { logger } from '@/lib/utils/logger'

/**
 * Enhanced POST /api/upload/from-url/enhanced
 *
 * Protected endpoint for downloading videos from URLs with automatic authentication.
 * Orchestrates the complete flow: cookie checking, auth detection, login handling, and download.
 *
 * Accepts JSON with:
 * - url: Video URL (YouTube, Vimeo, Panopto, Moodle, etc.)
 *
 * @returns Job status with tracking information
 */

import { getAuthUser } from '@/lib/auth/helpers'
import { isValidVideoUrl } from '@/lib/video-download/validators'
import { uploadToTelegram, isTelegramConfigured } from '@/lib/telegram/storage'
import { withErrorHandler } from '@/lib/middleware/error-handler'
import '@/lib/middleware/setup-error-handlers' // Initialize error handling for Node.js runtime
import {
  saveUploadMetadata,
  updateTelegramBackupId
} from '@/services/documents'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

export interface EnhancedUploadResponse {
  success: boolean
  message: string
  jobId: string
  status:
    | 'processing'
    | 'authentication_required'
    | 'authentication_successful'
    | 'download_started'
    | 'completed'
    | 'failed'
  authRequired?: boolean
  authPerformed?: boolean
  platform?: string
  authMethod?: 'stored' | 'interactive' | 'none'
  file?: {
    id: string
    filename: string
    size: number
    mimeType: string
    path: string
  }
  error?: string
  details?: string[]
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

// Import shared job store
import { jobStore } from '@/lib/services/job-store'

/**
 * Orchestrate the complete video download flow as specified in Task #10
 *
 * Flow:
 * 1. Extract url and userId from the request
 * 2. Check for cached cookies using CookieService.get()
 * 3. If no valid cookies, call isAuthRequired(url)
 * 4. If auth is required, call AuthenticationManager.handleLogin(url)
 * 5. If cookies are returned, save them using CookieService.set()
 * 6. Trigger DownloadManager.downloadWithCookies() in the background
 * 7. Return response with job ID
 */
async function orchestrateVideoDownload(
  jobId: string,
  url: string,
  userId: string
): Promise<void> {
  try {
    logger.info(`Starting orchestration for job ${jobId}: ${url}`)

    // Lazy import services to avoid stealth plugin initialization issues
    const { cookieService } = await import('@/lib/services/cookie-service')
    const { authRequirementDetector } = await import(
      '@/lib/services/auth-requirement-detector'
    )
    // Import authentication manager for future use
    // const { authenticationManager } = await import('@/lib/services/authentication-manager')

    // Step 2: Check for cached cookies using CookieService.get()
    const domain = new URL(url).hostname
    const sessionId = cookieService.generateSessionId()

    // Try to get existing cookies for this domain
    const existingCookies = await cookieService.getNetscapeCookies(
      userId,
      sessionId
    )

    if (existingCookies.success && existingCookies.data) {
      logger.info(
        `Found cached cookies for ${domain}, proceeding with download`
      )

      // Update job status
      jobStore.set(jobId, {
        status: 'authentication_successful',
        userId,
        url,
        startTime: Date.now()
      })

      // Step 6: Trigger DownloadManager.downloadWithCookies() in the background
      await triggerDownloadWithCookies(jobId, url, userId, existingCookies.data)
      return
    }

    // Step 3: If no valid cookies, call isAuthRequired(url)
    logger.info(
      `No cached cookies found, checking if authentication is required for ${url}`
    )

    const authDetection =
      await authRequirementDetector.detectAuthRequirement(url)
    logger.info(`Auth detection result for ${url}:`, {
      requiresAuth: authDetection.requiresAuth,
      confidence: authDetection.confidence,
      platform: authDetection.platform,
      indicators: authDetection.indicators,
      reasoning: authDetection.reasoning
    })

    if (!authDetection.requiresAuth) {
      logger.info(
        `No authentication required for ${url}, proceeding with normal download`
      )

      // Update job status
      jobStore.set(jobId, {
        status: 'download_started',
        userId,
        url,
        startTime: Date.now()
      })

      // Proceed with normal download
      await triggerNormalDownload(jobId, url, userId)
      return
    }

    // Step 4: If auth is required, return authentication required status
    // The frontend will handle authentication via mini-browser
    logger.info(
      `Authentication required for ${url} (${authDetection.platform}), returning auth required status`
    )

    jobStore.set(jobId, {
      status: 'authentication_required',
      userId,
      url,
      startTime: Date.now()
    })

    // Don&apos;t try to handle authentication in the backend
    // The frontend mini-browser will handle it
    return
  } catch (error) {
    logger.error(`Job ${jobId} orchestration failed:`, error)
    jobStore.set(jobId, {
      status: 'failed',
      userId,
      url,
      startTime: Date.now(),
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error during orchestration'
    })
  }
}

/**
 * Trigger download with cookies using EnhancedDownloadManager
 */
async function triggerDownloadWithCookies(
  jobId: string,
  url: string,
  userId: string,
  netscapeCookies: string
): Promise<void> {
  try {
    logger.info(`Starting download with cookies for job ${jobId}`)

    jobStore.set(jobId, {
      status: 'download_started',
      userId,
      url,
      startTime: Date.now()
    })

    // Lazy import enhanced download manager
    const { enhancedDownloadManager } = await import(
      '@/lib/services/enhanced-download-manager'
    )

    // Use EnhancedDownloadManager to download with cookies
    const downloadResult = await enhancedDownloadManager.downloadWithCookies({
      url,
      userId,
      netscapeCookies,
      options: {
        maxFileSize: MAX_FILE_SIZE
      }
    })

    if (!downloadResult.success) {
      jobStore.set(jobId, {
        status: 'failed',
        userId,
        url,
        startTime: Date.now(),
        ...(downloadResult.error ? { error: downloadResult.error } : {})
      })
      return
    }

    // Store file metadata in database
    const metadataResult = await saveUploadMetadata(
      downloadResult.fileId,
      userId,
      downloadResult.filename,
      downloadResult.size,
      downloadResult.mimeType,
      downloadResult.path
    )

    if (!metadataResult.success) {
      jobStore.set(jobId, {
        status: 'failed',
        userId,
        url,
        startTime: Date.now(),
        error: 'Failed to save file metadata'
      })
      return
    }

    // Upload to Telegram as backup (non-blocking)
    if (isTelegramConfigured()) {
      uploadToTelegram(
        downloadResult.path,
        downloadResult.filename,
        downloadResult.size,
        downloadResult.metadata?.sourceUrl
      )
        .then(async result => {
          if (result.success && result.fileId) {
            const updateResult = await updateTelegramBackupId(
              downloadResult.fileId,
              result.fileId
            )
            if (!updateResult.success) {
              logger.error(
                'Failed to update Telegram file ID',
                updateResult.error
              )
            }
          } else {
            logger.warn('Telegram backup failed', { error: result.error })
          }
        })
        .catch(error => {
          logger.error('Telegram upload error', error)
        })
    }

    // Mark job as completed
    jobStore.set(jobId, {
      status: 'completed',
      userId,
      url,
      startTime: Date.now(),
      result: {
        fileId: downloadResult.fileId,
        filename: downloadResult.filename,
        size: downloadResult.size,
        mimeType: downloadResult.mimeType,
        path: downloadResult.path,
        authRequired: true,
        authPerformed: true,
        platform: 'unknown',
        authMethod: 'interactive',
        cookiesExtracted: 0
      }
    })

    logger.info(`Job ${jobId} completed successfully`)
  } catch (error) {
    logger.error(`Download with cookies failed for job ${jobId}:`, error)
    jobStore.set(jobId, {
      status: 'failed',
      userId,
      url,
      startTime: Date.now(),
      error:
        error instanceof Error ? error.message : 'Unknown error during download'
    })
  }
}

/**
 * Trigger normal download without authentication
 */
async function triggerNormalDownload(
  jobId: string,
  url: string,
  userId: string
): Promise<void> {
  try {
    logger.info(`Starting normal download for job ${jobId}`)

    // Lazy import enhanced download manager and auth detector
    const { enhancedDownloadManager } = await import(
      '@/lib/services/enhanced-download-manager'
    )
    const { authRequirementDetector } = await import(
      '@/lib/services/auth-requirement-detector'
    )

    // Use EnhancedDownloadManager for normal download
    const downloadResult = await enhancedDownloadManager.downloadVideo(
      url,
      userId,
      {
        skipAuthDetection: true, // Skip auth detection since we already checked
        maxFileSize: MAX_FILE_SIZE
      }
    )

    if (!downloadResult.success) {
      // Check if the failure is due to authentication requirements
      const isAuthError =
        downloadResult.error?.includes('authentication') ||
        downloadResult.error?.includes('login') ||
        downloadResult.error?.includes('private') ||
        downloadResult.error?.includes('unauthorized') ||
        downloadResult.error?.includes('forbidden') ||
        downloadResult.error?.includes('signin') ||
        downloadResult.error?.includes('auth')

      if (isAuthError) {
        logger.info(
          `Download failed due to authentication for ${url}, triggering fallback auth detection`
        )

        // Re-run auth detection with higher sensitivity
        const fallbackAuthDetection =
          await authRequirementDetector.detectAuthRequirement(url, {
            timeout: 10000,
            followRedirects: true
          })

        if (fallbackAuthDetection.requiresAuth) {
          logger.info(
            `Fallback auth detection confirmed authentication required for ${url}`
          )
          jobStore.set(jobId, {
            status: 'authentication_required',
            userId,
            url,
            startTime: Date.now(),
            error:
              'Authentication required - download failed due to access restrictions'
          })
          return
        }
      }

      // If not an auth error or fallback detection didn't find auth requirement, mark as failed
      jobStore.set(jobId, {
        status: 'failed',
        userId,
        url,
        startTime: Date.now(),
        ...(downloadResult.error ? { error: downloadResult.error } : {})
      })
      return
    }

    // Store file metadata in database
    const metadataResult = await saveUploadMetadata(
      downloadResult.fileId,
      userId,
      downloadResult.filename,
      downloadResult.size,
      downloadResult.mimeType,
      downloadResult.path
    )

    if (!metadataResult.success) {
      jobStore.set(jobId, {
        status: 'failed',
        userId,
        url,
        startTime: Date.now(),
        error: 'Failed to save file metadata'
      })
      return
    }

    // Upload to Telegram as backup (non-blocking)
    if (isTelegramConfigured()) {
      uploadToTelegram(
        downloadResult.path,
        downloadResult.filename,
        downloadResult.size,
        downloadResult.metadata?.sourceUrl
      )
        .then(async result => {
          if (result.success && result.fileId) {
            const updateResult = await updateTelegramBackupId(
              downloadResult.fileId,
              result.fileId
            )
            if (!updateResult.success) {
              logger.error(
                'Failed to update Telegram file ID',
                updateResult.error
              )
            }
          } else {
            logger.warn('Telegram backup failed', { error: result.error })
          }
        })
        .catch(error => {
          logger.error('Telegram upload error', error)
        })
    }

    // Mark job as completed
    jobStore.set(jobId, {
      status: 'completed',
      userId,
      url,
      startTime: Date.now(),
      result: {
        fileId: downloadResult.fileId,
        filename: downloadResult.filename,
        size: downloadResult.size,
        mimeType: downloadResult.mimeType,
        path: downloadResult.path,
        authRequired: false,
        authPerformed: false,
        platform: downloadResult.platform,
        authMethod: 'none',
        cookiesExtracted: 0
      }
    })

    logger.info(`Job ${jobId} completed successfully`)
  } catch (error) {
    logger.error(`Normal download failed for job ${jobId}:`, error)
    jobStore.set(jobId, {
      status: 'failed',
      userId,
      url,
      startTime: Date.now(),
      error:
        error instanceof Error ? error.message : 'Unknown error during download'
    })
  }
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Get authenticated user
  const user = await getAuthUser(request)

  if (!user) {
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Unauthorized',
        details: ['Authentication required']
      },
      { status: 401 }
    )
  }

  // Parse request body
  const body = await request.json()
  const url = body.url as string | undefined

  if (!url) {
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Validation failed',
        details: ['No URL provided']
      },
      { status: 400 }
    )
  }

  // Validate URL
  const validation = isValidVideoUrl(url)
  if (!validation.isValid) {
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Validation failed',
        details: [validation.error || 'Invalid video URL']
      },
      { status: 400 }
    )
  }

  // Generate job ID
  const jobId = randomUUID()

  // Initialize job status
  jobStore.set(jobId, {
    status: 'processing',
    userId: user.id,
    url,
    startTime: Date.now()
  })

  // Start background orchestration process
  orchestrateVideoDownload(jobId, url, user.id).catch(error => {
    logger.error(`Background job ${jobId} failed:`, error)
  })

  // Return immediate response with job ID
  return NextResponse.json<EnhancedUploadResponse>(
    {
      success: true,
      message: 'Video download job started',
      jobId,
      status: 'processing'
    },
    { status: 202 } // Accepted - processing asynchronously
  )
})
