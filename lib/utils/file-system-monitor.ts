import { logger } from './logger'
import { existsSync, statSync } from 'fs'
import { join, dirname } from 'path'

/**
 * File system monitoring utilities for transcription operations
 */
export class FileSystemMonitor {
  private static instance: FileSystemMonitor
  private operations: Map<string, FileOperation> = new Map()
  private maxOperations = 1000 // Prevent memory leaks

  static getInstance(): FileSystemMonitor {
    if (!FileSystemMonitor.instance) {
      FileSystemMonitor.instance = new FileSystemMonitor()
    }
    return FileSystemMonitor.instance
  }

  /**
   * Track a file operation
   */
  trackOperation(
    operationId: string,
    type: 'create' | 'read' | 'write' | 'delete' | 'move',
    filePath: string,
    metadata?: Record<string, any>
  ): void {
    const operation: FileOperation = {
      id: operationId,
      type,
      filePath,
      timestamp: Date.now(),
      metadata: metadata || {}
    }

    this.operations.set(operationId, operation)

    // Clean up old operations to prevent memory leaks
    if (this.operations.size > this.maxOperations) {
      const oldestKey = this.operations.keys().next().value
      this.operations.delete(oldestKey)
    }

    logger.info('[FileSystemMonitor] Operation tracked', {
      operationId,
      type,
      filePath,
      timestamp: operation.timestamp
    })
  }

  /**
   * Complete a file operation
   */
  completeOperation(
    operationId: string,
    success: boolean,
    error?: string
  ): void {
    const operation = this.operations.get(operationId)
    if (!operation) {
      logger.warn('[FileSystemMonitor] Operation not found', { operationId })
      return
    }

    operation.completed = true
    operation.success = success
    operation.completedAt = Date.now()
    operation.duration = operation.completedAt - operation.timestamp

    if (error) {
      operation.error = error
    }

    logger.info('[FileSystemMonitor] Operation completed', {
      operationId,
      success,
      duration: operation.duration,
      error: operation.error
    })
  }

  /**
   * Get operation status
   */
  getOperationStatus(operationId: string): FileOperation | null {
    return this.operations.get(operationId) || null
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): FileOperation[] {
    return Array.from(this.operations.values()).filter(op => !op.completed)
  }

  /**
   * Get operations by file path
   */
  getOperationsByPath(filePath: string): FileOperation[] {
    return Array.from(this.operations.values()).filter(
      op => op.filePath === filePath
    )
  }

  /**
   * Clean up completed operations older than specified time
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [id, operation] of this.operations.entries()) {
      if (operation.completed && now - operation.timestamp > maxAge) {
        toDelete.push(id)
      }
    }

    toDelete.forEach(id => this.operations.delete(id))

    if (toDelete.length > 0) {
      logger.info('[FileSystemMonitor] Cleaned up old operations', {
        count: toDelete.length
      })
    }
  }

  /**
   * Check if file exists and is accessible
   */
  checkFileAccess(filePath: string): FileAccessResult {
    try {
      if (!existsSync(filePath)) {
        return {
          exists: false,
          accessible: false,
          error: 'File does not exist'
        }
      }

      const stats = statSync(filePath)
      return {
        exists: true,
        accessible: true,
        size: stats.size,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      }
    } catch (error) {
      return {
        exists: false,
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Monitor file system health during transcription
   */
  monitorTranscriptionHealth(uploadId: string, filePath: string): void {
    const operationId = `health-${uploadId}-${Date.now()}`

    this.trackOperation(operationId, 'read', filePath, {
      uploadId,
      purpose: 'health_check'
    })

    const accessResult = this.checkFileAccess(filePath)

    if (!accessResult.accessible) {
      logger.error('[FileSystemMonitor] File access issue detected', {
        uploadId,
        filePath,
        error: accessResult.error
      })
    }

    this.completeOperation(
      operationId,
      accessResult.accessible,
      accessResult.error
    )
  }
}

/**
 * File operation tracking interface
 */
export interface FileOperation {
  id: string
  type: 'create' | 'read' | 'write' | 'delete' | 'move'
  filePath: string
  timestamp: number
  completed?: boolean
  success?: boolean
  completedAt?: number
  duration?: number
  error?: string
  metadata: Record<string, any>
}

/**
 * File access result interface
 */
export interface FileAccessResult {
  exists: boolean
  accessible: boolean
  size?: number
  modified?: Date
  isFile?: boolean
  isDirectory?: boolean
  error?: string
}

// Export singleton instance
export const fileSystemMonitor = FileSystemMonitor.getInstance()
