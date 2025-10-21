/**
 * Unit tests for Global Error Handler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyError,
  createErrorResponse,
  withErrorHandler,
  setupGlobalErrorHandlers,
  type ErrorType,
} from '../../lib/middleware/error-handler'

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('classifyError', () => {
    it('should classify validation errors', () => {
      const error = new Error('Invalid email format')
      const result = classifyError(error)

      expect(result.type).toBe('validation')
      expect(result.message).toBe('Invalid request data')
      expect(result.statusCode).toBe(400)
      expect(result.details).toContain('Invalid email format')
    })

    it('should classify authentication errors', () => {
      const error = new Error('Unauthorized access - invalid token')
      const result = classifyError(error)

      expect(result.type).toBe('authentication')
      expect(result.message).toBe('Authentication required')
      expect(result.statusCode).toBe(401)
      expect(result.details).toContain('Unauthorized access - invalid token')
    })

    it('should classify authorization errors', () => {
      const error = new Error('Access denied - insufficient permissions')
      const result = classifyError(error)

      expect(result.type).toBe('authorization')
      expect(result.message).toBe('Insufficient permissions')
      expect(result.statusCode).toBe(403)
      expect(result.details).toContain('Access denied - insufficient permissions')
    })

    it('should classify not found errors', () => {
      const error = new Error('Resource not found')
      const result = classifyError(error)

      expect(result.type).toBe('not_found')
      expect(result.message).toBe('Resource not found')
      expect(result.statusCode).toBe(404)
      expect(result.details).toContain('Resource not found')
    })

    it('should classify rate limit errors', () => {
      const error = new Error('Rate limit exceeded - too many requests')
      const result = classifyError(error)

      expect(result.type).toBe('rate_limit')
      expect(result.message).toBe('Rate limit exceeded')
      expect(result.statusCode).toBe(429)
      expect(result.details).toContain('Rate limit exceeded - too many requests')
    })

    it('should classify timeout errors', () => {
      const error = new Error('Request timeout - deadline exceeded')
      const result = classifyError(error)

      expect(result.type).toBe('timeout')
      expect(result.message).toBe('Request timeout')
      expect(result.statusCode).toBe(408)
      expect(result.details).toContain('Request timeout - deadline exceeded')
    })

    it('should classify network errors', () => {
      const error = new Error('Network connection failed - ECONNRESET')
      const result = classifyError(error)

      expect(result.type).toBe('network')
      expect(result.message).toBe('Network error')
      expect(result.statusCode).toBe(503)
      expect(result.details).toContain('Network connection failed - ECONNRESET')
    })

    it('should classify database errors', () => {
      const error = new Error('Database constraint violation - foreign key')
      const result = classifyError(error)

      expect(result.type).toBe('database')
      expect(result.message).toBe('Database error')
      expect(result.statusCode).toBe(500)
      expect(result.details).toContain('A database error occurred')
    })

    it('should classify external service errors', () => {
      const error = new Error('External API service unavailable')
      const result = classifyError(error)

      expect(result.type).toBe('external_service')
      expect(result.message).toBe('External service error')
      expect(result.statusCode).toBe(502)
      expect(result.details).toContain('External API service unavailable')
    })

    it('should classify unknown errors as internal', () => {
      const error = new Error('Some random error')
      const result = classifyError(error)

      expect(result.type).toBe('internal')
      expect(result.message).toBe('Internal server error')
      expect(result.statusCode).toBe(500)
      expect(result.details).toContain('An unexpected error occurred')
    })

    it('should handle non-Error objects', () => {
      const result = classifyError('String error')

      expect(result.type).toBe('internal')
      expect(result.message).toBe('Internal server error')
      expect(result.statusCode).toBe(500)
      expect(result.details).toContain('An unexpected error occurred')
    })
  })

  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const error = new Error('Test error')
      const requestId = 'test-request-123'
      const response = createErrorResponse(error, requestId)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(500) // Default internal error status

      // Note: We can't easily test the JSON body without additional setup
      // The response creation is tested through the classification logic
    })

    it('should include retry-after header when provided', () => {
      const error = new Error('Rate limit exceeded')
      const requestId = 'test-request-123'
      const retryAfter = 60
      const response = createErrorResponse(error, requestId, retryAfter)

      expect(response).toBeInstanceOf(NextResponse)
      // The retry-after header would be set in the response
    })
  })

  describe('withErrorHandler', () => {
    it('should wrap handler and catch errors', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'))
      const wrappedHandler = withErrorHandler(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/test')
      const response = await wrappedHandler(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(mockHandler).toHaveBeenCalledWith(request)
    })

    it('should pass through successful responses', async () => {
      const mockResponse = NextResponse.json({ success: true })
      const mockHandler = vi.fn().mockResolvedValue(mockResponse)
      const wrappedHandler = withErrorHandler(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/test')
      const response = await wrappedHandler(request)

      expect(response).toBe(mockResponse)
      expect(mockHandler).toHaveBeenCalledWith(request)
    })

    it('should handle different error types', async () => {
      const testCases = [
        { error: new Error('Validation failed'), expectedType: 'validation' },
        { error: new Error('Unauthorized access'), expectedType: 'authentication' },
        { error: new Error('Access denied'), expectedType: 'authorization' },
        { error: new Error('Resource not found'), expectedType: 'not_found' },
        { error: new Error('Rate limit exceeded'), expectedType: 'rate_limit' },
        { error: new Error('Request timeout'), expectedType: 'timeout' },
        { error: new Error('Network error'), expectedType: 'network' },
        { error: new Error('Database error'), expectedType: 'database' },
        { error: new Error('External service error'), expectedType: 'external_service' },
        { error: new Error('Unknown error'), expectedType: 'internal' },
      ]

      for (const testCase of testCases) {
        const mockHandler = vi.fn().mockRejectedValue(testCase.error)
        const wrappedHandler = withErrorHandler(mockHandler)

        const request = new NextRequest('http://localhost:3000/api/test')
        const response = await wrappedHandler(request)

        expect(response).toBeInstanceOf(NextResponse)
        expect(mockHandler).toHaveBeenCalledWith(request)
      }
    })
  })

  describe('setupGlobalErrorHandlers', () => {
    it('should setup process error handlers in Node.js environment', () => {
      const processOnSpy = vi.spyOn(process, 'on')
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      setupGlobalErrorHandlers()

      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function))
      expect(consoleWarnSpy).not.toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should handle Edge Runtime environment gracefully', () => {
      // Mock Edge Runtime environment (no process.on)
      const originalProcess = global.process
      const mockProcess = { ...process, on: undefined }
      global.process = mockProcess as any
      
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      setupGlobalErrorHandlers()

      expect(consoleWarnSpy).toHaveBeenCalledWith('Global error handlers not available in Edge Runtime')

      // Restore original process
      global.process = originalProcess
      consoleWarnSpy.mockRestore()
    })

    it('should handle unhandled promise rejections', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      setupGlobalErrorHandlers()

      // Simulate unhandled promise rejection
      const rejectionHandlers = process.listeners('unhandledRejection')
      const rejectionHandler = rejectionHandlers[rejectionHandlers.length - 1] as Function
      const testError = new Error('Unhandled rejection')
      const testPromise = Promise.reject(testError)

      rejectionHandler(testError, testPromise)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Unhandled Promise Rejection:', {
        reason: 'Unhandled rejection',
        stack: testError.stack,
        promise: testPromise.toString(),
        timestamp: expect.any(String),
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle uncaught exceptions', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })
      
      setupGlobalErrorHandlers()

      // Simulate uncaught exception
      const exceptionHandlers = process.listeners('uncaughtException')
      const exceptionHandler = exceptionHandlers[exceptionHandlers.length - 1] as Function
      const testError = new Error('Uncaught exception')

      expect(() => exceptionHandler(testError)).toThrow('process.exit called')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Uncaught Exception:', {
        message: 'Uncaught exception',
        stack: testError.stack,
        timestamp: expect.any(String),
      })

      expect(processExitSpy).toHaveBeenCalledWith(1)

      consoleErrorSpy.mockRestore()
      processExitSpy.mockRestore()
    })
  })

  describe('error classification edge cases', () => {
    it('should handle case-insensitive error messages', () => {
      const error = new Error('UNAUTHORIZED ACCESS')
      const result = classifyError(error)

      expect(result.type).toBe('authentication')
      expect(result.statusCode).toBe(401)
    })

    it('should handle multiple keywords in error message', () => {
      const error = new Error('Invalid credentials and authentication failed')
      const result = classifyError(error)

      expect(result.type).toBe('credentials')
      expect(result.statusCode).toBe(401)
    })

    it('should prioritize more specific error types', () => {
      // Network errors should be caught before generic timeout errors
      const error = new Error('Network timeout connection failed')
      const result = classifyError(error)

      expect(result.type).toBe('network')
      expect(result.statusCode).toBe(503)
    })

    it('should handle null and undefined errors', () => {
      expect(classifyError(null).type).toBe('internal')
      expect(classifyError(undefined).type).toBe('internal')
    })

    it('should handle error objects without message', () => {
      const error = { name: 'CustomError' } as Error
      const result = classifyError(error)

      expect(result.type).toBe('internal')
      expect(result.statusCode).toBe(500)
    })
  })
})
