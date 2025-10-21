/**
 * Vitest setup file
 * Global test configuration and setup
 */

import { vi } from 'vitest'

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.COOKIE_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long'
process.env.PUPPETEER_HEADLESS = 'true'
process.env.AUTH_SESSION_TIMEOUT = '300000'
process.env.COOKIE_EXPIRY_HOURS = '24'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.MAX_DOWNLOAD_SIZE_MB = '500'
process.env.DOWNLOAD_TIMEOUT_MS = '300000'
process.env.YT_DLP_PATH = 'yt-dlp'

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock fetch for tests
global.fetch = vi.fn()

// Mock crypto for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-123'),
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
  },
})

// Mock process.uptime for tests
vi.spyOn(process, 'uptime').mockReturnValue(12345)

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})
