/**
 * Service Startup and Management
 * Starts and monitors background services
 */

import { getScraperService, getProcessorService, getValidatorService } from './services';
import { createLogger } from './utils';
import { initializeGitHubTokens } from './init-tokens';

const logger = createLogger('STARTUP');

let servicesStarted = false;

/**
 * Start all background services
 */
export async function startBackgroundServices() {
  if (servicesStarted) {
    logger.warn('Services already started');
    return;
  }

  logger.always('Starting background services...');

  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.error(`Missing environment variables: ${missing.join(', ')}`);
    return;
  }

  // Initialize GitHub tokens from environment to database
  try {
    await initializeGitHubTokens();
  } catch (error: any) {
    logger.error(`Failed to initialize tokens: ${error.message}`);
    logger.warn('Continuing without GitHub token initialization');
  }

  try {
    const scraper = getScraperService({
      batchSize: 10,  // Very small batches to avoid rate limits
      rateLimitCooldown: 3600000,
      continuousScraping: true,
    });

    scraper.start().catch(error => {
      logger.error(`Scraper crashed: ${error.message}`);
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const processor = getProcessorService({
      batchSize: 20,
      delayBetweenKeys: 2000,
      continuousProcessing: true,
      cycleCooldown: 30000,
    });

    processor.start().catch(error => {
      logger.error(`Processor crashed: ${error.message}`);
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const validator = getValidatorService({
      batchSize: 10,
      delayBetweenKeys: 2000,
      deleteInvalidKeys: true,
      keepQuotaKeys: true,
      continuousValidation: true,
      cycleCooldown: 300000,
    });

    validator.start().catch(error => {
      logger.error(`Validator crashed: ${error.message}`);
    });

    servicesStarted = true;
    logger.always('All services started successfully');

    setupGracefulShutdown();
  } catch (error: any) {
    logger.error(`Failed to start services: ${error.message}`);
  }
}

/**
 * Stop all background services
 */
export function stopBackgroundServices() {
  logger.always('Stopping background services...');

  try {
    getScraperService().stop();
    getProcessorService().stop();
    getValidatorService().stop();
    servicesStarted = false;
    logger.always('All services stopped');
  } catch (error: any) {
    logger.error(`Error stopping services: ${error.message}`);
  }
}

/**
 * Get status of all services
 */
export function getServicesStatus() {
  const scraper = getScraperService();
  const processor = getProcessorService();
  const validator = getValidatorService();

  return {
    scraper: {
      running: scraper.isRunning(),
      stats: scraper.isRunning() ? scraper.getStats() : null,
    },
    processor: {
      running: processor.isRunning(),
      stats: processor.isRunning() ? processor.getStats() : null,
    },
    validator: {
      running: validator.isRunning(),
      stats: validator.isRunning() ? validator.getStats() : null,
    },
  };
}

/**
 * Setup graceful shutdown
 */
function setupGracefulShutdown() {
  const shutdown = () => {
    logger.warn('Received shutdown signal');
    stopBackgroundServices();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('beforeExit', shutdown);
}

/**
 * Start periodic status monitoring
 */
export function startStatusMonitor(intervalMinutes = 10) {
  setInterval(() => {
    const status = getServicesStatus();
    
    logger.always('=== Service Status ===');
    
    if (status.scraper.running && status.scraper.stats) {
      const s = status.scraper.stats;
      logger.always(`Scraper: scraped=${s.totalScraped}, saved=${s.totalSaved}, phase=${s.currentPhase}`);
    }

    if (status.processor.running && status.processor.stats) {
      const p = status.processor.stats;
      logger.always(`Processor: processed=${p.totalProcessed}, valid=${p.validKeys}, invalid=${p.invalidKeys}`);
    }

    if (status.validator.running && status.validator.stats) {
      const v = status.validator.stats;
      logger.always(`Validator: validated=${v.totalProcessed}, deleted=${v.keysDeleted}`);
    }
  }, intervalMinutes * 60 * 1000);
}

// Auto-start if running directly
if (require.main === module) {
  startBackgroundServices().then(() => {
    logger.always('Services running. Press Ctrl+C to stop');
    startStatusMonitor(10);
  });
}
