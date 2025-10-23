import { logger } from '@/lib/utils/logger'

/**
 * Custom error classes for type-safe error handling
 */

export class ValidationError extends Error {
  public readonly field: string
  public readonly code: string

  constructor(
    message: string,
    field: string,
    code: string = 'VALIDATION_ERROR'
  ) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.code = code
  }
}

export class DatabaseError extends Error {
  public readonly operation: string
  public readonly table: string
  public readonly originalError?: Error

  constructor(
    message: string,
    operation: string,
    table: string,
    originalError?: Error
  ) {
    super(message)
    this.name = 'DatabaseError'
    this.operation = operation
    this.table = table
    if (originalError) {
      this.originalError = originalError
    }
  }
}

export class AuthenticationError extends Error {
  public readonly code: string

  constructor(message: string, code: string = 'AUTHENTICATION_ERROR') {
    super(message)
    this.name = 'AuthenticationError'
    this.code = code
  }
}

export class AuthorizationError extends Error {
  public readonly resource: string
  public readonly action: string

  constructor(message: string, resource: string, action: string) {
    super(message)
    this.name = 'AuthorizationError'
    this.resource = resource
    this.action = action
  }
}

export class APIError extends Error {
  public readonly statusCode: number
  public readonly endpoint: string

  constructor(message: string, statusCode: number, endpoint: string) {
    super(message)
    this.name = 'APIError'
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}

/**
 * Type guard to check if error is a custom error type
 */
export function isCustomError(
  error: unknown
): error is
  | ValidationError
  | DatabaseError
  | AuthenticationError
  | AuthorizationError
  | APIError {
  return (
    error instanceof ValidationError ||
    error instanceof DatabaseError ||
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error instanceof APIError
  )
}

/**
 * Extract safe error message for user display
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.message
  }

  if (error instanceof AuthenticationError) {
    return 'Authentication failed. Please try logging in again.'
  }

  if (error instanceof AuthorizationError) {
    return 'You do not have permission to perform this action.'
  }

  if (error instanceof APIError) {
    return 'A server error occurred. Please try again later.'
  }

  if (error instanceof DatabaseError) {
    return 'A database error occurred. Please try again later.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred. Please try again later.'
}

/**
 * Log error with appropriate level and context
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const logData = {
    error: {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    },
    context,
    timestamp: new Date().toISOString()
  }

  // In production, you would send this to your logging service
  // For development, we use the logger service
  if (process.env.NODE_ENV === 'development') {
    logger.error('Error logged', logData)
  }
}
