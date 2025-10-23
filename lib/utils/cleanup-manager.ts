import { logger } from './logger'
import { existsSync, unlinkSync, rmdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { fileSystemMonitor } from './file-system-monitor'

/**
 * Cleanup manager for temporary files and failed transcription jobs
 */
export class CleanupManager {
  private static instance: CleanupManager
  private cleanupInterval: NodeJS.Timeout | null = null

  static getInstance(): CleanupManager {
    if (!CleanupManager.instance) {
      CleanupManager.instance = new CleanupManager()
    }
    return CleanupManager.instance
  }

  /**
   * Start automatic cleanup process
   */
  startAutoCleanup(intervalMs: number = 60 * 60 * 1000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
    }, intervalMs)

    logger.info('[CleanupManager] Auto cleanup started', { intervalMs })
  }

  /**
   * Stop automatic cleanup process
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
      logger.info('[CleanupManager] Auto cleanup stopped')
    }
  }

  /**
   * Perform comprehensive cleanup
   */
  async performCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      tempFilesRemoved: 0,
      tempDirectoriesRemoved: 0,
      failedJobsCleaned: 0,
      errors: []
    }

    try {
      // Clean up temporary files
      await this.cleanupTempFiles(result)

      // Clean up failed transcription jobs
      await this.cleanupFailedJobs(result)

      // Clean up old file system monitoring data
      fileSystemMonitor.cleanup(24 * 60 * 60 * 1000) // 24 hours

      logger.info('[CleanupManager] Cleanup completed', result)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(errorMessage)
      logger.error('[CleanupManager] Cleanup failed', { error: errorMessage })
    }

    return result
  }

  /**
   * Clean up temporary files older than specified age
   */
  private async cleanupTempFiles(
    result: CleanupResult,
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<void> {
    const tempDirs = [
      join(process.cwd(), 'tmp', 'uploads'),
      join(process.cwd(), 'tmp', 'archives'),
      join(process.cwd(), 'tmp', 'transcriptions')
    ]

    for (const tempDir of tempDirs) {
      if (!existsSync(tempDir)) continue

      try {
        const files = readdirSync(tempDir, { withFileTypes: true })
        const now = Date.now()

        for (const file of files) {
          const filePath = join(tempDir, file.name)
          const stats = statSync(filePath)
          const age = now - stats.mtime.getTime()

          if (age > maxAge) {
            try {
              if (file.isDirectory()) {
                this.removeDirectoryRecursive(filePath)
                result.tempDirectoriesRemoved++
              } else {
                unlinkSync(filePath)
                result.tempFilesRemoved++
              }

              logger.debug('[CleanupManager] Removed old file', {
                filePath,
                age
              })
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error'
              result.errors.push(
                `Failed to remove ${filePath}: ${errorMessage}`
              )
            }
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Failed to scan ${tempDir}: ${errorMessage}`)
      }
    }
  }

  /**
   * Clean up failed transcription jobs
   */
  private async cleanupFailedJobs(result: CleanupResult): Promise<void> {
    try {
      // This would typically involve database cleanup
      // For now, we'll just clean up the in-memory queue
      // In a real implementation, you'd clean up failed database records

      logger.info('[CleanupManager] Failed jobs cleanup completed')
      result.failedJobsCleaned = 0 // Placeholder
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Failed to clean up failed jobs: ${errorMessage}`)
    }
  }

  /**
   * Remove directory recursively
   */
  private removeDirectoryRecursive(dirPath: string): void {
    if (!existsSync(dirPath)) return

    const files = readdirSync(dirPath, { withFileTypes: true })

    for (const file of files) {
      const filePath = join(dirPath, file.name)

      if (file.isDirectory()) {
        this.removeDirectoryRecursive(filePath)
      } else {
        unlinkSync(filePath)
      }
    }

    rmdirSync(dirPath)
  }

  /**
   * Clean up specific upload files
   */
  async cleanupUploadFiles(uploadId: string): Promise<boolean> {
    try {
      const uploadDir = join(process.cwd(), 'tmp', 'uploads', uploadId)

      if (existsSync(uploadDir)) {
        this.removeDirectoryRecursive(uploadDir)
        logger.info('[CleanupManager] Cleaned up upload files', { uploadId })
        return true
      }

      return false
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('[CleanupManager] Failed to clean up upload files', {
        uploadId,
        error: errorMessage
      })
      return false
    }
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats(): CleanupStats {
    const tempDirs = [
      join(process.cwd(), 'tmp', 'uploads'),
      join(process.cwd(), 'tmp', 'archives'),
      join(process.cwd(), 'tmp', 'transcriptions')
    ]

    let totalFiles = 0
    let totalSize = 0
    const now = Date.now()

    for (const tempDir of tempDirs) {
      if (!existsSync(tempDir)) continue

      try {
        const files = readdirSync(tempDir, { withFileTypes: true })

        for (const file of files) {
          const filePath = join(tempDir, file.name)
          const stats = statSync(filePath)

          totalFiles++
          totalSize += stats.size
        }
      } catch (error) {
        // Ignore errors when scanning
      }
    }

    return {
      totalFiles,
      totalSize,
      lastCleanup: this.cleanupInterval ? 'active' : 'inactive'
    }
  }
}

/**
 * Cleanup result interface
 */
export interface CleanupResult {
  tempFilesRemoved: number
  tempDirectoriesRemoved: number
  failedJobsCleaned: number
  errors: string[]
}

/**
 * Cleanup statistics interface
 */
export interface CleanupStats {
  totalFiles: number
  totalSize: number
  lastCleanup: string
}

// Export singleton instance
export const cleanupManager = CleanupManager.getInstance()

// Start auto cleanup on module load
cleanupManager.startAutoCleanup()
