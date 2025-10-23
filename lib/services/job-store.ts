import { logger } from '@/lib/utils/logger'

/**
 * Shared job status store for enhanced URL downloads
 * Centralized storage for job state across different API routes
 */

export interface JobData {
  status:
    | 'processing'
    | 'authentication_required'
    | 'authentication_successful'
    | 'download_started'
    | 'completed'
    | 'failed'
  userId: string
  url: string
  startTime: number
  result?: any
  error?: string
  progress?: {
    percentage: number
    downloaded: number
    total: number
    speed?: string
    eta?: string
  }
}

/**
 * In-memory job status storage
 * Uses global variable to persist across Next.js API route calls in development
 * In production, this should be replaced with Redis or a database
 */

// Use global variable to persist jobs across hot reloads in development
const globalForJobStore = global as unknown as {
  jobStoreMap: Map<string, JobData> | undefined
}

if (!globalForJobStore.jobStoreMap) {
  globalForJobStore.jobStoreMap = new Map<string, JobData>()
  logger.info('[JobStore] Initialized global job store')
}

class JobStore {
  private get jobs(): Map<string, JobData> {
    return globalForJobStore.jobStoreMap!
  }

  /**
   * Set job data
   */
  set(jobId: string, data: JobData): void {
    logger.debug(`[JobStore] Setting job ${jobId} status: ${data.status}`)
    this.jobs.set(jobId, data)
  }

  /**
   * Get job data by ID
   */
  get(jobId: string): JobData | undefined {
    const job = this.jobs.get(jobId)
    logger.debug(
      `[JobStore] Getting job ${jobId}: ${job ? job.status : 'not found'}`
    )
    return job
  }

  /**
   * Delete job data
   */
  delete(jobId: string): boolean {
    logger.debug(`[JobStore] Deleting job ${jobId}`)
    return this.jobs.delete(jobId)
  }

  /**
   * Check if job exists
   */
  has(jobId: string): boolean {
    return this.jobs.has(jobId)
  }

  /**
   * Get all job IDs
   */
  getAllJobIds(): string[] {
    return Array.from(this.jobs.keys())
  }

  /**
   * Get job count
   */
  getJobCount(): number {
    return this.jobs.size
  }

  /**
   * Clean up old jobs (older than maxAge milliseconds)
   */
  cleanup(maxAge: number = 3600000): number {
    // Default: 1 hour
    const now = Date.now()
    let cleaned = 0

    for (const [jobId, job] of this.jobs.entries()) {
      if (now - job.startTime > maxAge) {
        this.jobs.delete(jobId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info(`[JobStore] Cleaned up ${cleaned} old jobs`)
    }

    return cleaned
  }
}

// Export singleton instance
export const jobStore = new JobStore()
