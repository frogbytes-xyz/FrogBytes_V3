import { logger } from '@/lib/utils/logger'

/**
 * Video Download System Configuration
 * Centralized configuration for the video download system including
 * Puppeteer, Redis, and authentication settings.
 */

import { z } from 'zod'

// Environment validation schema
const VideoDownloadConfigSchema = z.object({
  // Puppeteer Configuration
  puppeteerHeadless: z.boolean().default(false),
  puppeteerExecutablePath: z.string().optional(),
  puppeteerUserDataDir: z.string().default('/tmp/puppeteer-user-data'),
  
  // Authentication & Session Management
  authSessionTimeout: z.number().default(300000), // 5 minutes
  cookieEncryptionKey: z.string().min(32, 'Cookie encryption key must be at least 32 characters'),
  cookieExpiryHours: z.number().default(24),
  
  // Redis Configuration
  redisUrl: z.string().default('redis://localhost:6379'),
  redisPassword: z.string().optional(),
  redisDb: z.number().default(0),
  
  // Download Configuration
  maxDownloadSizeMB: z.number().default(500),
  downloadTimeoutMs: z.number().default(300000), // 5 minutes
  ytDlpPath: z.string().default('yt-dlp'),
  
  // Security
  nodeEnv: z.enum(['development', 'staging', 'production', 'test']).default('development'),
})

export type VideoDownloadConfig = z.infer<typeof VideoDownloadConfigSchema>

/**
 * Load and validate video download configuration from environment variables
 */
export function loadVideoDownloadConfig(): VideoDownloadConfig {
  const rawConfig = {
    // Puppeteer Configuration
    puppeteerHeadless: process.env.PUPPETEER_HEADLESS === 'true',
    puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    puppeteerUserDataDir: process.env.PUPPETEER_USER_DATA_DIR || '/tmp/puppeteer-user-data',
    
    // Authentication & Session Management
    authSessionTimeout: parseInt(process.env.AUTH_SESSION_TIMEOUT || '300000', 10),
    cookieEncryptionKey: process.env.COOKIE_ENCRYPTION_KEY || generateDefaultEncryptionKey(),
    cookieExpiryHours: parseInt(process.env.COOKIE_EXPIRY_HOURS || '24', 10),
    
    // Redis Configuration
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    redisPassword: process.env.REDIS_PASSWORD,
    redisDb: parseInt(process.env.REDIS_DB || '0', 10),
    
    // Download Configuration
    maxDownloadSizeMB: parseInt(process.env.MAX_DOWNLOAD_SIZE_MB || '500', 10),
    downloadTimeoutMs: parseInt(process.env.DOWNLOAD_TIMEOUT_MS || '300000', 10),
    ytDlpPath: process.env.YT_DLP_PATH || 'yt-dlp',
    
    // Security
    nodeEnv: (process.env.NODE_ENV as 'development' | 'staging' | 'production' | 'test') || 'development',
  }

  try {
    return VideoDownloadConfigSchema.parse(rawConfig)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      throw new Error(`Video download configuration validation failed:\n${errorMessages.join('\n')}`)
    }
    throw error
  }
}

/**
 * Generate a default encryption key for development
 * WARNING: This should only be used in development!
 */
function generateDefaultEncryptionKey(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('COOKIE_ENCRYPTION_KEY environment variable is required in production. Please set a secure 32+ character encryption key')
  }
  
  // Generate a random 32-character key for development
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  logger.warn('[WARNING] Using auto-generated encryption key for development. Set COOKIE_ENCRYPTION_KEY in production!')
  return result
}

/**
 * Validate that all required external dependencies are available
 */
export async function validateDependencies(): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = []
  
  try {
    // Check if yt-dlp is available
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    await execAsync('yt-dlp --version')
  } catch (error) {
    errors.push('yt-dlp is not installed or not in PATH')
  }
  
  try {
    // Check if Redis is accessible
    const { createClient } = await import('redis')
    const config = loadVideoDownloadConfig()
    const client = createClient({
      url: config.redisUrl,
      ...(config.redisPassword && { password: config.redisPassword }),
      database: config.redisDb,
    })
    
    await client.connect()
    await client.ping()
    await client.disconnect()
  } catch (error) {
    errors.push('Redis is not accessible. Please ensure Redis is running and accessible.')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Export the loaded configuration as a singleton
export const videoDownloadConfig = loadVideoDownloadConfig()
