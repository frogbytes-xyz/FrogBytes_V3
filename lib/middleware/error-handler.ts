import { NextResponse, type NextRequest } from 'next/server'

/**
 * Error types for classification
 */
export type ErrorType = 
  | 'validation' 
  | 'authentication' 
  | 'credentials'
  | 'authorization' 
  | 'not_found' 
  | 'rate_limit' 
  | 'timeout' 
  | 'network' 
  | 'database' 
  | 'external_service' 
  | 'internal' 
  | 'unknown'

/**
 * Standardized error response structure
 */
export interface ErrorResponse {
  success: false
  error: string
  errorType: ErrorType
  details?: string[]
  timestamp: string
  requestId?: string
  retryAfter?: number
}

/**
 * Error classification function
 */
export function classifyError(error: unknown): {
  type: ErrorType
  message: string
  statusCode: number
  details?: string[]
} {
  // Handle different error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    
    // Credentials errors (check before authentication)
    if (message.includes('invalid credentials') || message.includes('wrong password') ||
        message.includes('incorrect username') || message.includes('login failed') ||
        message.includes('authentication failed')) {
      return {
        type: 'credentials',
        message: 'Invalid credentials',
        statusCode: 401,
        details: [error.message]
      }
    }
    
    // Authentication errors (check before validation to avoid conflicts)
    if (message.includes('unauthorized') || message.includes('authentication') ||
        message.includes('token') || message.includes('jwt')) {
      return {
        type: 'authentication',
        message: 'Authentication required',
        statusCode: 401,
        details: [error.message]
      }
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || 
        message.includes('required') || message.includes('format')) {
      return {
        type: 'validation',
        message: 'Invalid request data',
        statusCode: 400,
        details: [error.message]
      }
    }
    
    // Authorization errors
    if (message.includes('forbidden') || message.includes('permission') ||
        message.includes('access denied') || message.includes('insufficient') ||
        message.includes('not allowed') || message.includes('denied')) {
      return {
        type: 'authorization',
        message: 'Insufficient permissions',
        statusCode: 403,
        details: [error.message]
      }
    }
    
    // Not found errors
    if (message.includes('not found') || message.includes('does not exist') ||
        message.includes('missing')) {
      return {
        type: 'not_found',
        message: 'Resource not found',
        statusCode: 404,
        details: [error.message]
      }
    }
    
    // Rate limit errors
    if (message.includes('rate limit') || message.includes('too many requests') ||
        message.includes('quota exceeded')) {
      return {
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        statusCode: 429,
        details: [error.message]
      }
    }
    
    // Network errors (check before timeout to catch network timeouts)
    if (message.includes('network') || message.includes('connection') ||
        message.includes('dns') || message.includes('econnreset') ||
        message.includes('network timeout') || message.includes('connection timeout')) {
      return {
        type: 'network',
        message: 'Network error',
        statusCode: 503,
        details: [error.message]
      }
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out') ||
        message.includes('deadline')) {
      return {
        type: 'timeout',
        message: 'Request timeout',
        statusCode: 408,
        details: [error.message]
      }
    }
    
    // Database errors
    if (message.includes('database') || message.includes('sql') ||
        message.includes('constraint') || message.includes('foreign key')) {
      return {
        type: 'database',
        message: 'Database error',
        statusCode: 500,
        details: ['A database error occurred']
      }
    }
    
    // External service errors
    if (message.includes('api') || message.includes('service') ||
        message.includes('external') || message.includes('third party')) {
      return {
        type: 'external_service',
        message: 'External service error',
        statusCode: 502,
        details: [error.message]
      }
    }
  }
  
  // Default to internal server error
  return {
    type: 'internal',
    message: 'Internal server error',
    statusCode: 500,
    details: ['An unexpected error occurred']
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: unknown,
  requestId?: string,
  retryAfter?: number
): NextResponse<ErrorResponse> {
  const classification = classifyError(error)
  
  const errorResponse: ErrorResponse = {
    success: false,
    error: classification.message,
    errorType: classification.type,
    details: classification.details,
    timestamp: new Date().toISOString(),
    requestId,
    retryAfter
  }
  
  // Log error for monitoring
  console.error('Global error handler:', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    type: classification.type,
    statusCode: classification.statusCode,
    requestId,
    timestamp: errorResponse.timestamp
  })
  
  return NextResponse.json(errorResponse, {
    status: classification.statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...(retryAfter && { 'Retry-After': retryAfter.toString() })
    }
  })
}

/**
 * Global error handler wrapper for API routes
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      // Generate request ID for tracking
      const requestId = crypto.randomUUID()
      
      return createErrorResponse(error, requestId)
    }
  }
}

/**
 * Handle unhandled promise rejections
 * Only works in Node.js runtime, not in Edge Runtime
 */
export function setupGlobalErrorHandlers() {
  // Check if we're in a Node.js environment (not Edge Runtime)
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection:', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString(),
        timestamp: new Date().toISOString()
      })
    })
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      
      // Exit gracefully
      process.exit(1)
    })
  } else {
    // In Edge Runtime, we can't set up global handlers
    // The error handling will be done at the individual route level
    console.warn('Global error handlers not available in Edge Runtime')
  }
}
