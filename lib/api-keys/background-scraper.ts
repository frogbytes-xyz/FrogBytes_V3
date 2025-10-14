/**
 * Background Scraper Service
 * Manages background scraping operations
 */

import { scrapeGitHubKeys } from './scraper';
import { createLogger } from './utils';

const logger = createLogger('BACKGROUND-SCRAPER');

class BackgroundScraper {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private stopRequested = false;

  async start(options?: { 
    intervalMinutes?: number; 
    onProgress?: (progress: any) => void;
    limit?: number;
  }): Promise<void> {
    if (this.isRunning) {
      logger.warn('Background scraper is already running');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    const intervalMinutes = options?.intervalMinutes || 60; // Default 1 hour
    
    logger.always(`[BACKGROUND] Starting background scraper with ${intervalMinutes} minute intervals`);

    // Run immediately
    await this.runScrapeTask(options);

    // Schedule recurring runs
    this.intervalId = setInterval(async () => {
      if (!this.stopRequested) {
        await this.runScrapeTask(options);
      }
    }, intervalMinutes * 60 * 1000);
  }

  async stop(): Promise<void> {
    logger.always('[BACKGROUND] Stopping background scraper...');
    this.stopRequested = true;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    logger.always('[BACKGROUND] Background scraper stopped');
  }

  async restart(options?: { 
    intervalMinutes?: number; 
    onProgress?: (progress: any) => void;
    limit?: number;
  }): Promise<void> {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.start(options);
  }

  isActive(): boolean {
    return this.isRunning && !this.stopRequested;
  }

  getStatus(): { 
    isRunning: boolean; 
    stopRequested: boolean; 
    hasInterval: boolean 
  } {
    return {
      isRunning: this.isRunning,
      stopRequested: this.stopRequested,
      hasInterval: this.intervalId !== null
    };
  }

  private async runScrapeTask(options?: { 
    onProgress?: (progress: any) => void;
    limit?: number;
  }): Promise<void> {
    if (this.stopRequested) return;

    try {
      logger.always('[BACKGROUND] Starting scrape task...');
      
      const results = await scrapeGitHubKeys(
        options?.limit || 100,
        options?.onProgress || ((progress) => {
          logger.always(`[BACKGROUND] Progress: ${progress.found} keys found, ${progress.processed}/${progress.total} processed`);
        }),
        {
          validateKeys: false, // Background scraper doesn't validate to keep it fast
          storeInDatabase: true
        }
      );

      logger.always(`[BACKGROUND] Scrape task completed: ${results.length} keys found`);
    } catch (error) {
      logger.error('[BACKGROUND] Scrape task failed:', error);
    }
  }
}

// Singleton instance
let backgroundScraperInstance: BackgroundScraper | null = null;

export function getBackgroundScraper(): BackgroundScraper {
  if (!backgroundScraperInstance) {
    backgroundScraperInstance = new BackgroundScraper();
  }
  return backgroundScraperInstance;
}

export { BackgroundScraper };
