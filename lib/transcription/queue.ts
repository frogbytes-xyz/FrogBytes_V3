import { logger } from '@/lib/utils/logger'
import { processTranscriptionJob, type TranscriptionJob } from './worker'
import { transcriptionMonitor } from '@/lib/monitoring/transcription-monitor'

/**
 * Simple in-memory transcription queue
 * In production, this should be replaced with a proper queue system (Redis, Bull, etc.)
 */
class TranscriptionQueue {
  private queue: TranscriptionJob[] = []
  private processing: Set<string> = new Set()
  private completed: Map<string, any> = new Map()
  private failed: Map<string, string> = new Map()

  /**
   * Add a transcription job to the queue
   */
  async enqueue(job: TranscriptionJob): Promise<string> {
    const jobId = `${job.uploadId}-${Date.now()}`

    // Check if already processing or completed
    if (this.processing.has(job.uploadId)) {
      throw new Error('Transcription already in progress')
    }

    if (this.completed.has(job.uploadId)) {
      return jobId
    }

    if (this.failed.has(job.uploadId)) {
      throw new Error('Transcription previously failed')
    }

    this.queue.push(job)
    logger.info('[TranscriptionQueue] Job enqueued', {
      jobId,
      uploadId: job.uploadId
    })

    // Start monitoring
    transcriptionMonitor.startMonitoring(job.uploadId, job.userId, job.fileName)
    transcriptionMonitor.logEvent(job.uploadId, 'queued', { jobId })

    // Process queue asynchronously
    this.processQueue()

    return jobId
  }

  /**
   * Get job status
   */
  getStatus(
    uploadId: string
  ): 'queued' | 'processing' | 'completed' | 'failed' | 'not_found' {
    if (this.processing.has(uploadId)) return 'processing'
    if (this.completed.has(uploadId)) return 'completed'
    if (this.failed.has(uploadId)) return 'failed'
    if (this.queue.some(job => job.uploadId === uploadId)) return 'queued'
    return 'not_found'
  }

  /**
   * Get job result
   */
  getResult(uploadId: string): any {
    return this.completed.get(uploadId)
  }

  /**
   * Get job error
   */
  getError(uploadId: string): string | undefined {
    return this.failed.get(uploadId)
  }

  /**
   * Process the queue asynchronously
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return

    const job = this.queue.shift()
    if (!job) return

    const uploadId = job.uploadId
    this.processing.add(uploadId)

    logger.info('[TranscriptionQueue] Processing job', { uploadId })

    // Update monitoring
    transcriptionMonitor.updateStatus(uploadId, 'processing')
    transcriptionMonitor.logEvent(uploadId, 'processing_started', {
      timestamp: Date.now()
    })

    try {
      const result = await processTranscriptionJob(job)

      if (result.success) {
        this.completed.set(uploadId, result)
        transcriptionMonitor.updateStatus(uploadId, 'completed')
        transcriptionMonitor.logEvent(uploadId, 'completed', {
          transcriptionId: result.transcriptionId
        })
        transcriptionMonitor.completeMonitoring(uploadId, true)
        logger.info('[TranscriptionQueue] Job completed successfully', {
          uploadId
        })
      } else {
        this.failed.set(uploadId, result.error || 'Unknown error')
        transcriptionMonitor.logError(uploadId, result.error || 'Unknown error')
        transcriptionMonitor.completeMonitoring(uploadId, false)
        logger.error('[TranscriptionQueue] Job failed', {
          uploadId,
          error: result.error
        })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.failed.set(uploadId, errorMessage)
      transcriptionMonitor.logError(uploadId, errorMessage, { error })
      transcriptionMonitor.completeMonitoring(uploadId, false)
      logger.error('[TranscriptionQueue] Job error', {
        uploadId,
        error: errorMessage
      })
    } finally {
      this.processing.delete(uploadId)

      // Process next job in queue
      if (this.queue.length > 0) {
        // Use setTimeout to prevent stack overflow
        setTimeout(() => this.processQueue(), 100)
      }
    }
  }

  /**
   * Clean up old completed jobs (prevent memory leaks)
   */
  cleanup(): void {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    // Clean up completed jobs older than maxAge
    for (const [uploadId, result] of this.completed.entries()) {
      if (now - result.timestamp > maxAge) {
        this.completed.delete(uploadId)
      }
    }

    // Clean up failed jobs older than maxAge
    for (const [uploadId, error] of this.failed.entries()) {
      if (now - error.timestamp > maxAge) {
        this.failed.delete(uploadId)
      }
    }
  }
}

// Global queue instance
export const transcriptionQueue = new TranscriptionQueue()

// Cleanup every hour
setInterval(
  () => {
    transcriptionQueue.cleanup()
  },
  60 * 60 * 1000
)
