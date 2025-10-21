import { logger } from '@/lib/utils/logger'

/**
 * Utility functions for API key management
 */

/**
 * Validates if a string matches the expected Gemini API key format
 */
export function isValidKeyFormat(key: string): boolean {
  if (!key.startsWith('AIza')) return false;
  if (key.length < 35 || key.length > 40) return false;
  if (!/^AIza[A-Za-z0-9_-]+$/.test(key)) return false;

  const invalidPatterns = [
    /test/i, /example/i, /sample/i, /demo/i, /fake/i,
    /placeholder/i, /your_api_key/i, /xxx+/i, /000+/i,
    /111+/i, /abc+/i
  ];

  if (invalidPatterns.some(pattern => pattern.test(key))) {
    return false;
  }

  const uniqueChars = new Set(key.split('')).size;
  if (uniqueChars < 10) return false;

  return true;
}

/**
 * Split array into chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Delay helper
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format duration in human readable format
 */
export function formatDuration(startTime: Date): string {
  const duration = Date.now() - startTime.getTime();
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Create safe logger that prevents excessive console output
 */
export function createLogger(prefix: string, verbose = false) {
  return {
    info: (message: string, ...args: any[]) => {
      if (verbose) logger.info(`[${prefix}] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      logger.warn(`[${prefix}] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      logger.error(`[${prefix}] ${message}`, ...args);
    },
    always: (message: string, ...args: any[]) => {
      logger.info(`[${prefix}] ${message}`, ...args);
    }
  };
}
