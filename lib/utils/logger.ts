/**
 * Professional logging utility for FrogBytes
 * Provides structured logging with different severity levels
 * and environment-aware behavior
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isDevelopment: boolean
  private minLevel: LogLevel

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.minLevel = this.getMinLogLevel()
  }

  private getMinLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase()
    switch (envLevel) {
      case 'debug':
        return LogLevel.DEBUG
      case 'info':
        return LogLevel.INFO
      case 'warn':
        return LogLevel.WARN
      case 'error':
        return LogLevel.ERROR
      default:
        return this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR
    ]
    const currentLevelIndex = levels.indexOf(this.minLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`

    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`
    }

    return `${prefix} ${message}`
  }

  /**
   * Log debug-level messages (verbose information for development)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return

    if (this.isDevelopment) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context))
    }
  }

  /**
   * Log informational messages (general application flow)
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return
    console.log(this.formatMessage(LogLevel.INFO, message, context))
  }

  /**
   * Log warning messages (potential issues that don&apos;t stop execution)
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return
    console.warn(this.formatMessage(LogLevel.WARN, message, context))
  }

  /**
   * Log error messages (serious issues that need attention)
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return

    const errorContext: LogContext = { ...context }

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } else if (error) {
      errorContext.error = error
    }

    console.error(this.formatMessage(LogLevel.ERROR, message, errorContext))
  }

  /**
   * Log objects for debugging (only in development)
   */
  debugObject(label: string, obj: unknown): void {
    if (!this.isDevelopment || !this.shouldLog(LogLevel.DEBUG)) return

    console.log(`[DEBUG] ${label}:`, obj)
  }
}

// Export singleton instance
export const logger = new Logger()
