/**
 * Continuous Validator Service
 * Manages continuous validation of API keys
 */

import { validateGeminiKey } from './validator';
import { storeValidationResult, getPendingKeysForValidation } from './database';
import { createLogger } from './utils';

const logger = createLogger('CONTINUOUS-VALIDATOR');

interface ValidationProgress {
  total: number;
  processed: number;
  valid: number;
  invalid: number;
  errors: number;
  currentKey: string;
  startTime: Date;
}

type ValidationProgressCallback = (progress: ValidationProgress) => void;

class ContinuousValidator {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private stopRequested = false;

  async start(options?: { 
    intervalMinutes?: number; 
    onProgress?: ValidationProgressCallback;
    batchSize?: number;
  }): Promise<void> {
    if (this.isRunning) {
      logger.warn('Continuous validator is already running');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    const intervalMinutes = options?.intervalMinutes || 30; // Default 30 minutes
    
    logger.always(`[CONTINUOUS] Starting continuous validator with ${intervalMinutes} minute intervals`);

    // Run immediately
    await this.runValidationTask(options);

    // Schedule recurring runs
    this.intervalId = setInterval(async () => {
      if (!this.stopRequested) {
        await this.runValidationTask(options);
      }
    }, intervalMinutes * 60 * 1000);
  }

  async stop(): Promise<void> {
    logger.always('[CONTINUOUS] Stopping continuous validator...');
    this.stopRequested = true;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    logger.always('[CONTINUOUS] Continuous validator stopped');
  }

  async restart(options?: { 
    intervalMinutes?: number; 
    onProgress?: ValidationProgressCallback;
    batchSize?: number;
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

  private async runValidationTask(options?: { 
    onProgress?: ValidationProgressCallback;
    batchSize?: number;
  }): Promise<void> {
    if (this.stopRequested) return;

    try {
      logger.always('[CONTINUOUS] Starting validation task...');
      
      // Get unvalidated keys from database
      const unvalidatedKeys = await getPendingKeysForValidation(options?.batchSize || 50);
      
      if (unvalidatedKeys.length === 0) {
        logger.always('[CONTINUOUS] No unvalidated keys found');
        return;
      }

      const progress: ValidationProgress = {
        total: unvalidatedKeys.length,
        processed: 0,
        valid: 0,
        invalid: 0,
        errors: 0,
        currentKey: '',
        startTime: new Date()
      };

      logger.always(`[CONTINUOUS] Found ${unvalidatedKeys.length} unvalidated keys`);

      for (const key of unvalidatedKeys) {
        if (this.stopRequested) break;

        progress.currentKey = key.key.substring(0, 12) + '...';
        progress.processed++;

        try {
          const validationResult = await validateGeminiKey(key.key);
          await storeValidationResult(validationResult);

          if (validationResult.isValid) {
            progress.valid++;
            logger.always(`[CONTINUOUS] [VALID] Valid key: ${key.key.substring(0, 12)}...`);
          } else {
            progress.invalid++;
            logger.always(`[CONTINUOUS] [INVALID] Invalid key: ${key.key.substring(0, 12)}...`);
          }
        } catch (error) {
          progress.errors++;
          logger.error(`[CONTINUOUS] Validation error for ${key.key.substring(0, 12)}...:`, error);
        }

        // Call progress callback
        if (options?.onProgress) {
          options.onProgress(progress);
        }

        // Small delay between validations to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.always(`[CONTINUOUS] Validation task completed: ${progress.valid} valid, ${progress.invalid} invalid, ${progress.errors} errors`);
    } catch (error) {
      logger.error('[CONTINUOUS] Validation task failed:', error);
    }
  }
}

// Singleton instance
let continuousValidatorInstance: ContinuousValidator | null = null;

export function getContinuousValidator(): ContinuousValidator {
  if (!continuousValidatorInstance) {
    continuousValidatorInstance = new ContinuousValidator();
  }
  return continuousValidatorInstance;
}

export { ContinuousValidator, type ValidationProgress, type ValidationProgressCallback };
