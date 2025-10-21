/**
 * Integration tests for Enhanced Video Download API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/upload/from-url/enhanced/route'
import { GET } from '../../../../app/api/upload/from-url/enhanced/[jobId]/route'

// Mock dependencies
vi.mock('@/lib/auth/helpers', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/services/enhanced-download-manager', () => ({
  enhancedDownloadManager: {
    downloadVideo: vi.fn(),
    validateConfig: vi.fn(),
  },
}))

vi.mock('@/lib/video-download/validators', () => ({
  isValidVideoUrl: vi.fn(),
}))

vi.mock('@/lib/telegram/storage', () => ({
  uploadToTelegram: vi.fn(),
  isTelegramConfigured: vi.fn(),
}))

vi.mock('@/services/documents', () => ({
  saveUploadMetadata: vi.fn(),
  updateTelegramBackupId: vi.fn(),
}))

// Mock crypto
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-job-id-123'),
  default: {
    randomUUID: vi.fn(() => 'test-job-id-123'),
  },
}))

describe('Enhanced Video Download API', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Default mock implementations
    const { getAuthUser } = await import('@/lib/auth/helpers')
    vi.mocked(getAuthUser).mockResolvedValue(mockUser)

    const { isValidVideoUrl } = await import('@/lib/video-download/validators')
    vi.mocked(isValidVideoUrl).mockReturnValue({ isValid: true })

    const { enhancedDownloadManager } = await import('@/lib/services/enhanced-download-manager')
    vi.mocked(enhancedDownloadManager.validateConfig).mockReturnValue({ isValid: true, errors: [] })
    vi.mocked(enhancedDownloadManager.downloadVideo).mockResolvedValue({
      success: true,
      fileId: 'file123',
      filename: 'test-video.mp4',
      size: 1024000,
      mimeType: 'video/mp4',
      path: '/tmp/test-video.mp4',
      authRequired: false,
      authPerformed: false,
      platform: 'youtube',
      authMethod: 'none',
    })

    const { saveUploadMetadata } = await import('@/services/documents')
    vi.mocked(saveUploadMetadata).mockResolvedValue({ success: true })

    const { isTelegramConfigured } = await import('@/lib/telegram/storage')
    vi.mocked(isTelegramConfigured).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/upload/from-url/enhanced', () => {
    it('should start video download job successfully', async () => {
      // Arrange
      const requestBody = {
        url: 'https://youtube.com/watch?v=test',
      }

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(202) // Accepted
      expect(data.success).toBe(true)
      expect(data.jobId).toBe('test-job-id-123')
      expect(data.status).toBe('processing')
      expect(data.message).toBe('Video download job started')
    })

    it('should handle authentication required videos', async () => {
      // Arrange
      const requestBody = {
        url: 'https://panopto.edu/video',
        authOptions: {
          platform: 'panopto',
        },
      }

      const { enhancedDownloadManager } = require('@/lib/services/enhanced-download-manager')
      vi.mocked(enhancedDownloadManager.downloadVideo).mockResolvedValue({
        success: true,
        fileId: 'file123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
        authRequired: true,
        authPerformed: true,
        platform: 'panopto',
        authMethod: 'interactive',
        cookiesExtracted: 5,
      })

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.jobId).toBe('test-job-id-123')
      expect(data.status).toBe('processing')
    })

    it('should handle invalid URLs', async () => {
      // Arrange
      const { isValidVideoUrl } = require('@/lib/video-download/validators')
      vi.mocked(isValidVideoUrl).mockReturnValue({
        isValid: false,
        error: 'Invalid URL format',
      })

      const requestBody = {
        url: 'invalid-url',
      }

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation failed')
      expect(data.details).toContain('Invalid URL format')
    })

    it('should handle missing URL', async () => {
      // Arrange
      const requestBody = {}

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation failed')
      expect(data.details).toContain('No URL provided')
    })

    it('should handle unauthenticated requests', async () => {
      // Arrange
      const { getAuthUser } = require('@/lib/auth/helpers')
      vi.mocked(getAuthUser).mockResolvedValue(null)

      const requestBody = {
        url: 'https://youtube.com/watch?v=test',
      }

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle configuration validation failures', async () => {
      // Arrange
      const { enhancedDownloadManager } = require('@/lib/services/enhanced-download-manager')
      vi.mocked(enhancedDownloadManager.validateConfig).mockReturnValue({
        isValid: false,
        errors: ['Cookie service is not ready'],
      })

      const requestBody = {
        url: 'https://youtube.com/watch?v=test',
      }

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Configuration error')
      expect(data.details).toContain('Cookie service is not ready')
    })

    it('should handle force authentication', async () => {
      // Arrange
      const requestBody = {
        url: 'https://youtube.com/watch?v=test',
        forceAuth: true,
        authOptions: {
          platform: 'youtube',
        },
      }

      const { enhancedDownloadManager } = require('@/lib/services/enhanced-download-manager')
      vi.mocked(enhancedDownloadManager.downloadVideo).mockResolvedValue({
        success: true,
        fileId: 'file123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
        authRequired: false,
        authPerformed: true, // Forced authentication
        platform: 'youtube',
        authMethod: 'interactive',
      })

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.jobId).toBe('test-job-id-123')
    })

    it('should handle skip authentication detection', async () => {
      // Arrange
      const requestBody = {
        url: 'https://panopto.edu/video',
        skipAuthDetection: true,
      }

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.jobId).toBe('test-job-id-123')
    })
  })

  describe('GET /api/upload/from-url/enhanced/[jobId]', () => {
    it('should return job status for completed job', async () => {
      // Arrange
      const { jobStatus } = require('../../../../app/api/upload/from-url/enhanced/[jobId]/route')
      jobStatus.set('test-job-id-123', {
        status: 'completed',
        userId: 'user123',
        url: 'https://youtube.com/watch?v=test',
        startTime: Date.now(),
        result: {
          fileId: 'file123',
          filename: 'test-video.mp4',
          size: 1024000,
          mimeType: 'video/mp4',
          path: '/tmp/test-video.mp4',
          authRequired: false,
          authPerformed: false,
          platform: 'youtube',
          authMethod: 'none',
          cookiesExtracted: 0,
        },
      })

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced/test-job-id-123')

      // Act
      const response = await GET(request, { params: { jobId: 'test-job-id-123' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.jobId).toBe('test-job-id-123')
      expect(data.status).toBe('completed')
      expect(data.message).toBe('Video download completed successfully')
      expect(data.file).toEqual({
        id: 'file123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      })
      expect(data.authRequired).toBe(false)
      expect(data.authPerformed).toBe(false)
      expect(data.platform).toBe('youtube')
      expect(data.authMethod).toBe('none')
    })

    it('should return job status for failed job', async () => {
      // Arrange
      const { jobStatus } = require('../../../../app/api/upload/from-url/enhanced/[jobId]/route')
      jobStatus.set('test-job-id-123', {
        status: 'failed',
        userId: 'user123',
        url: 'https://youtube.com/watch?v=test',
        startTime: Date.now(),
        error: 'Download failed',
      })

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced/test-job-id-123')

      // Act
      const response = await GET(request, { params: { jobId: 'test-job-id-123' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.jobId).toBe('test-job-id-123')
      expect(data.status).toBe('failed')
      expect(data.message).toBe('Video download failed')
      expect(data.error).toBe('Download failed')
    })

    it('should return job status for processing job', async () => {
      // Arrange
      const { jobStatus } = require('../../../../app/api/upload/from-url/enhanced/[jobId]/route')
      jobStatus.set('test-job-id-123', {
        status: 'processing',
        userId: 'user123',
        url: 'https://youtube.com/watch?v=test',
        startTime: Date.now(),
      })

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced/test-job-id-123')

      // Act
      const response = await GET(request, { params: { jobId: 'test-job-id-123' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(false) // Not completed yet
      expect(data.jobId).toBe('test-job-id-123')
      expect(data.status).toBe('processing')
      expect(data.message).toBe('Processing video download request')
    })

    it('should handle job not found', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced/nonexistent-job')

      // Act
      const response = await GET(request, { params: { jobId: 'nonexistent-job' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Job not found')
    })

    it('should handle unauthorized access to job', async () => {
      // Arrange
      const { jobStatus } = require('../../../../app/api/upload/from-url/enhanced/[jobId]/route')
      jobStatus.set('test-job-id-123', {
        status: 'completed',
        userId: 'other-user',
        url: 'https://youtube.com/watch?v=test',
        startTime: Date.now(),
      })

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced/test-job-id-123')

      // Act
      const response = await GET(request, { params: { jobId: 'test-job-id-123' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Forbidden')
    })

    it('should handle unauthenticated requests', async () => {
      // Arrange
      const { getAuthUser } = require('@/lib/auth/helpers')
      vi.mocked(getAuthUser).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced/test-job-id-123')

      // Act
      const response = await GET(request, { params: { jobId: 'test-job-id-123' } })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('integration test', () => {
    it('should perform complete video download workflow', async () => {
      // This test simulates the complete workflow described in the task
      // Arrange
      const requestBody = {
        url: 'https://panopto.edu/video',
        authOptions: {
          platform: 'panopto',
          timeout: 300000,
        },
        cookieOptions: {
          secureOnly: true,
          maxCookies: 10,
        },
      }

      const { enhancedDownloadManager } = require('@/lib/services/enhanced-download-manager')
      vi.mocked(enhancedDownloadManager.downloadVideo).mockResolvedValue({
        success: true,
        fileId: 'file123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
        authRequired: true,
        authPerformed: true,
        platform: 'panopto',
        authMethod: 'interactive',
        cookiesExtracted: 5,
      })

      const request = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      // Act - Start job
      const response = await POST(request)
      const data = await response.json()

      // Assert - Job started
      expect(response.status).toBe(202)
      expect(data.success).toBe(true)
      expect(data.jobId).toBe('test-job-id-123')
      expect(data.status).toBe('processing')

      // Simulate job completion by setting job status
      const { jobStatus } = require('../../../../app/api/upload/from-url/enhanced/[jobId]/route')
      jobStatus.set('test-job-id-123', {
        status: 'completed',
        userId: 'user123',
        url: 'https://panopto.edu/video',
        startTime: Date.now(),
        result: {
          fileId: 'file123',
          filename: 'test-video.mp4',
          size: 1024000,
          mimeType: 'video/mp4',
          path: '/tmp/test-video.mp4',
          authRequired: true,
          authPerformed: true,
          platform: 'panopto',
          authMethod: 'interactive',
          cookiesExtracted: 5,
        },
      })

      // Act - Check job status
      const statusRequest = new NextRequest('http://localhost:3000/api/upload/from-url/enhanced/test-job-id-123')
      const statusResponse = await GET(statusRequest, { params: { jobId: 'test-job-id-123' } })
      const statusData = await statusResponse.json()

      // Assert - Job completed
      expect(statusResponse.status).toBe(200)
      expect(statusData.success).toBe(true)
      expect(statusData.status).toBe('completed')
      expect(statusData.authRequired).toBe(true)
      expect(statusData.authPerformed).toBe(true)
      expect(statusData.platform).toBe('panopto')
      expect(statusData.authMethod).toBe('interactive')
      expect(statusData.cookiesExtracted).toBe(5)
    })
  })
})
