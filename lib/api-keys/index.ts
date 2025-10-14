/**
 * API Keys Module
 * Centralized exports for API key management
 */

// Types
export type {
  ApiKeyRecord,
  ScrapedKey,
  ValidationResult,
  ScraperConfig,
  ValidatorConfig,
  ProcessorConfig,
  ServiceStats,
  ScraperStats,
  ValidatorStats,
  ProcessorStats
} from './types';

// Validator
export { validateGeminiKey, validateKeys } from './validator';

// Scraper
export {
  scrapeGitHubKeys,
  scrapeAllSources
} from './scraper';

// Manager
export {
  addApiKey,
  getAvailableKey,
  getAvailableKeys,
  markKeySuccess,
  markKeyFailure,
  validateAllKeys,
  getKeyPoolStats
} from './manager';

// Services
export {
  getScraperService,
  getProcessorService,
  getValidatorService
} from './services';

// Startup
export {
  startBackgroundServices,
  stopBackgroundServices,
  getServicesStatus,
  startStatusMonitor
} from './startup';

// Utils
export {
  isValidKeyFormat,
  chunk,
  delay,
  formatDuration,
  createLogger
} from './utils';
