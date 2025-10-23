import { logger } from '@/lib/utils/logger'

/**
 * Comprehensive monitoring for transcription process
 */
export class TranscriptionMonitor {
  private static instance: TranscriptionMonitor
  private metrics: Map<string, TranscriptionMetrics> = new Map()
  private alerts: Alert[] = []

  static getInstance(): TranscriptionMonitor {
    if (!TranscriptionMonitor.instance) {
      TranscriptionMonitor.instance = new TranscriptionMonitor()
    }
    return TranscriptionMonitor.instance
  }

  /**
   * Start monitoring a transcription job
   */
  startMonitoring(uploadId: string, userId: string, fileName: string): void {
    const metrics: TranscriptionMetrics = {
      uploadId,
      userId,
      fileName,
      startTime: Date.now(),
      status: 'started',
      events: [],
      performance: {
        queueTime: 0,
        processingTime: 0,
        totalTime: 0
      },
      errors: []
    }

    this.metrics.set(uploadId, metrics)

    this.logEvent(uploadId, 'monitoring_started', {
      userId,
      fileName,
      timestamp: new Date().toISOString()
    })

    logger.info('[TranscriptionMonitor] Started monitoring', {
      uploadId,
      userId,
      fileName
    })
  }

  /**
   * Log an event for a transcription job
   */
  logEvent(uploadId: string, event: string, data: any): void {
    const metrics = this.metrics.get(uploadId)
    if (!metrics) {
      logger.warn('[TranscriptionMonitor] Metrics not found for upload', {
        uploadId
      })
      return
    }

    const eventData = {
      event,
      data,
      timestamp: Date.now()
    }

    metrics.events.push(eventData)

    // Log the event
    logger.info('[TranscriptionMonitor] Event logged', {
      uploadId,
      event,
      data
    })

    // Check for performance issues
    this.checkPerformanceIssues(uploadId, metrics)
  }

  /**
   * Update job status
   */
  updateStatus(uploadId: string, status: TranscriptionStatus): void {
    const metrics = this.metrics.get(uploadId)
    if (!metrics) return

    metrics.status = status
    metrics.lastUpdate = Date.now()

    this.logEvent(uploadId, 'status_updated', { status })

    // Calculate performance metrics
    if (status === 'completed' || status === 'failed') {
      this.calculatePerformanceMetrics(uploadId, metrics)
    }
  }

  /**
   * Log an error for a transcription job
   */
  logError(uploadId: string, error: string, details?: any): void {
    const metrics = this.metrics.get(uploadId)
    if (!metrics) return

    const errorData = {
      error,
      details,
      timestamp: Date.now()
    }

    metrics.errors.push(errorData)
    metrics.status = 'failed'

    this.logEvent(uploadId, 'error_occurred', { error, details })

    // Create alert for critical errors
    this.createAlert(uploadId, 'error', error, details)
  }

  /**
   * Complete monitoring for a job
   */
  completeMonitoring(uploadId: string, success: boolean): void {
    const metrics = this.metrics.get(uploadId)
    if (!metrics) return

    metrics.status = success ? 'completed' : 'failed'
    metrics.endTime = Date.now()
    metrics.performance.totalTime = metrics.endTime - metrics.startTime

    this.logEvent(uploadId, 'monitoring_completed', {
      success,
      totalTime: metrics.performance.totalTime
    })

    logger.info('[TranscriptionMonitor] Monitoring completed', {
      uploadId,
      success,
      totalTime: metrics.performance.totalTime
    })

    // Clean up old metrics after 24 hours
    setTimeout(
      () => {
        this.metrics.delete(uploadId)
      },
      24 * 60 * 60 * 1000
    )
  }

  /**
   * Get metrics for a specific job
   */
  getMetrics(uploadId: string): TranscriptionMetrics | null {
    return this.metrics.get(uploadId) || null
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): TranscriptionMetrics[] {
    return Array.from(this.metrics.values()).filter(
      m => m.status === 'started' || m.status === 'processing'
    )
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    const allMetrics = Array.from(this.metrics.values())
    const completedJobs = allMetrics.filter(m => m.status === 'completed')
    const failedJobs = allMetrics.filter(m => m.status === 'failed')

    const totalTimes = completedJobs.map(m => m.performance.totalTime)
    const avgProcessingTime =
      totalTimes.length > 0
        ? totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length
        : 0

    return {
      totalJobs: allMetrics.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      successRate:
        allMetrics.length > 0
          ? (completedJobs.length / allMetrics.length) * 100
          : 0,
      avgProcessingTime,
      activeJobs: this.getActiveJobs().length,
      recentErrors: this.alerts.filter(a => a.type === 'error').length
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): Alert[] {
    return this.alerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
  }

  /**
   * Check for performance issues
   */
  private checkPerformanceIssues(
    uploadId: string,
    metrics: TranscriptionMetrics
  ): void {
    const now = Date.now()
    const elapsed = now - metrics.startTime

    // Alert if job is taking too long
    if (elapsed > 10 * 60 * 1000 && metrics.status === 'processing') {
      // 10 minutes
      this.createAlert(
        uploadId,
        'performance',
        'Job taking longer than expected',
        {
          elapsed,
          status: metrics.status
        }
      )
    }

    // Alert if too many errors
    if (metrics.errors.length > 3) {
      this.createAlert(uploadId, 'error', 'Multiple errors detected', {
        errorCount: metrics.errors.length
      })
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(
    uploadId: string,
    metrics: TranscriptionMetrics
  ): void {
    const events = metrics.events
    const queueStart = events.find(e => e.event === 'queued')?.timestamp
    const processingStart = events.find(
      e => e.event === 'processing_started'
    )?.timestamp
    const completed = events.find(e => e.event === 'completed')?.timestamp

    if (queueStart && processingStart) {
      metrics.performance.queueTime = processingStart - queueStart
    }

    if (processingStart && completed) {
      metrics.performance.processingTime = completed - processingStart
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    uploadId: string,
    type: AlertType,
    message: string,
    details?: any
  ): void {
    const alert: Alert = {
      id: `${uploadId}-${Date.now()}`,
      uploadId,
      type,
      message,
      details,
      timestamp: Date.now()
    }

    this.alerts.push(alert)

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    logger.warn('[TranscriptionMonitor] Alert created', alert)
  }
}

/**
 * Transcription metrics interface
 */
export interface TranscriptionMetrics {
  uploadId: string
  userId: string
  fileName: string
  startTime: number
  endTime?: number
  status: TranscriptionStatus
  events: EventLog[]
  performance: PerformanceMetrics
  errors: ErrorLog[]
  lastUpdate?: number
}

/**
 * Transcription status type
 */
export type TranscriptionStatus =
  | 'started'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

/**
 * Event log interface
 */
export interface EventLog {
  event: string
  data: any
  timestamp: number
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  queueTime: number
  processingTime: number
  totalTime: number
}

/**
 * Error log interface
 */
export interface ErrorLog {
  error: string
  details?: any
  timestamp: number
}

/**
 * Performance statistics interface
 */
export interface PerformanceStats {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  successRate: number
  avgProcessingTime: number
  activeJobs: number
  recentErrors: number
}

/**
 * Alert interface
 */
export interface Alert {
  id: string
  uploadId: string
  type: AlertType
  message: string
  details?: any
  timestamp: number
}

/**
 * Alert type
 */
export type AlertType = 'error' | 'performance' | 'warning'

// Export singleton instance
export const transcriptionMonitor = TranscriptionMonitor.getInstance()
