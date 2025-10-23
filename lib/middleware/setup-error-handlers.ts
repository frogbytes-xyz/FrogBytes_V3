import { logger } from '@/lib/utils/logger'

/**
 * Setup global error handlers for Node.js runtime environments
 * This should only be imported in Node.js runtime contexts (API routes, server components)
 * NOT in Edge Runtime contexts (middleware)
 */

import { setupGlobalErrorHandlers } from './error-handler'

/**
 * Initialize global error handling for the application
 * Call this once at application startup in Node.js runtime
 */
export function initializeErrorHandling() {
  try {
    setupGlobalErrorHandlers()
    logger.info('Global error handlers initialized successfully')
  } catch (error) {
    logger.warn('Failed to initialize global error handlers', { error: error })
  }
}

// Auto-initialize if this module is imported in a Node.js environment
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  initializeErrorHandling()
}
