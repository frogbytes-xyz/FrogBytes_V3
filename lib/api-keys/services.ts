/**
 * API Key Services
 * Orchestrates scraping, validation, and processing of API keys
 */

import { createClient } from '@supabase/supabase-js';
import { scrapeGitHubKeys } from './scraper';
import { validateGeminiKey } from './validator';
import { storeValidationResult } from './database';
import type {
  ScraperConfig,
  ValidatorConfig,
  ProcessorConfig,
  ScraperStats,
  ValidatorStats,
  ProcessorStats
} from './types';
import { chunk, delay, createLogger } from './utils';

const scraperLogger = createLogger('SCRAPER');
const validatorLogger = createLogger('VALIDATOR');
const processorLogger = createLogger('PROCESSOR');

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Background Key Scraper Service
 */
class KeyScraperService {
  private running = false;
  private stats: ScraperStats;
  private seenKeys = new Set<string>();
  private supabase;
  private config: ScraperConfig;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      batchSize: 100,
      rateLimitCooldown: 3600000,
      continuousScraping: true,
      ...config
    };
    this.supabase = getSupabaseClient();
    this.stats = {
      startTime: new Date(),
      totalProcessed: 0,
      totalScraped: 0,
      totalSaved: 0,
      duplicates: 0,
      rateLimitHits: 0,
      currentPhase: 'idle',
      lastActivity: new Date(),
    };
  }

  async start() {
    if (this.running) return;

    this.running = true;
    this.stats.startTime = new Date();
    
    scraperLogger.always('Starting background scraper');

    try {
      await this.testConnection();
      await this.loadExistingKeys();
      await this.scrapeLoop();
    } catch (error: any) {
      scraperLogger.error(`Failed to start: ${error.message}`);
      this.running = false;
    }
  }

  stop() {
    this.running = false;
    scraperLogger.always(`Stopped. Total scraped: ${this.stats.totalScraped}, saved: ${this.stats.totalSaved}`);
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): ScraperStats {
    return { ...this.stats };
  }

  private async testConnection() {
    const { error } = await this.supabase
      .from('potential_keys')
      .select('id')
      .limit(1);
    
    if (error) {
      throw new Error(`Database table 'potential_keys' not accessible: ${error.message}`);
    }
  }

  private async loadExistingKeys() {
    try {
      scraperLogger.always(`[INIT] Loading existing keys from database to prevent duplicates...`);

      // Load all keys from both tables to build the seenKeys set
      // This prevents the scraper from trying to insert duplicates
      const [potentialResult, workingResult] = await Promise.all([
        this.supabase.from('potential_keys').select('api_key'),
        this.supabase.from('working_gemini_keys').select('api_key'),
      ]);

      let potentialCount = 0;
      let workingCount = 0;

      if (potentialResult.error) {
        scraperLogger.error(`[INIT] Error loading potential_keys: ${potentialResult.error.message}`);
      } else if (potentialResult.data) {
        potentialResult.data.forEach((row: any) => this.seenKeys.add(row.api_key));
        potentialCount = potentialResult.data.length;
      }

      if (workingResult.error) {
        scraperLogger.error(`[INIT] Error loading working_gemini_keys: ${workingResult.error.message}`);
      } else if (workingResult.data) {
        workingResult.data.forEach((row: any) => this.seenKeys.add(row.api_key));
        workingCount = workingResult.data.length;
      }

      scraperLogger.always(`[INIT] ✓ Loaded ${this.seenKeys.size} existing keys (${potentialCount} potential, ${workingCount} working)`);
      scraperLogger.always(`[INIT] Scraper will skip any keys already in this set`);
    } catch (error: any) {
      scraperLogger.error(`[INIT] Error loading existing keys: ${error.message}`);
      scraperLogger.error(`[INIT] Continuing without duplicate checking - database will handle it`);
    }
  }

  private async scrapeLoop() {
    let iteration = 0;

    while (this.running) {
      if (this.config.maxDuration && (Date.now() - this.stats.startTime.getTime()) > this.config.maxDuration) {
        break;
      }

      iteration++;
      scraperLogger.always(`[LOOP] === Starting iteration ${iteration} ===`);

      try {
        // Reload keys from database every 10 iterations to stay in sync
        // This catches keys added by other processes or during this session
        if (iteration % 10 === 1) {
          scraperLogger.always(`[LOOP] Refreshing key list from database (iteration ${iteration})`);
          await this.loadExistingKeys();
        }

        this.stats.currentPhase = 'scraping';
        const newKeys = await this.scrapePhase();

        scraperLogger.always(`[LOOP] scrapePhase returned ${newKeys.length} keys`);

        // Keys are now saved immediately in scrapePhase
        if (newKeys.length > 0) {
          scraperLogger.always(`[LOOP] ✅ ${newKeys.length} new keys were saved immediately during scraping`);
        } else {
          scraperLogger.always(`[LOOP] No new keys found this iteration`);
        }

        // End of iteration summary
        scraperLogger.always(`[LOOP] 📊 Iteration ${iteration} Summary: ${newKeys.length} new keys saved immediately, ${this.stats.totalSaved} total in DB`);

        if (!this.config.continuousScraping) break;

        this.stats.currentPhase = 'idle';
        scraperLogger.always(`[LOOP] Iteration ${iteration} complete, waiting 5s before next iteration`);
        await delay(5000);

      } catch (error: any) {
        if (error.message?.includes('rate limit')) {
          this.stats.rateLimitHits++;
          this.stats.currentPhase = 'rate-limited';
          scraperLogger.warn(`Rate limit hit ${this.stats.rateLimitHits} times, cooling down`);
          await delay(this.config.rateLimitCooldown);
        } else {
          scraperLogger.error(`Unexpected error: ${error.message}`);
          await delay(10000);
        }
      }
    }

    scraperLogger.always(`[LOOP] Scraper loop stopped after ${iteration} iterations`);
    this.running = false;
  }

  private async scrapePhase(): Promise<Array<{ key: string; source: string; sourceUrl: string }>> {
    const newKeys: Array<{ key: string; source: string; sourceUrl: string }> = [];

    try {
      scraperLogger.always(`[SCRAPE] Starting scrape phase with batch size: ${this.config.batchSize}`);

      // Calculate query rotation index based on current time to get different results each call
      const queryRotation = Math.floor(Date.now() / 60000) % 100; // Changes every minute
      
      scraperLogger.always(`[SCRAPE] Passing ${this.seenKeys.size} existing keys to scraper to avoid duplicates`);
      
      // Use enhanced GitHub code search only (Gist functionality removed)
      // NOTE: storeInDatabase=false because THIS service handles saving via immediate saves
      const codeKeys = await scrapeGitHubKeys(this.config.batchSize, undefined, {
        validateKeys: false,
        storeInDatabase: false,  // Service handles DB storage immediately
        startQueryIndex: queryRotation, // Rotate queries for diversity
        existingKeys: this.seenKeys // Pass existing keys to avoid re-scraping
      });

      scraperLogger.always(`[SCRAPE] Enhanced GitHub search returned ${codeKeys.length} keys (query rotation: ${queryRotation})`);
      
      // Debug: Log the actual keys returned by enhanced GitHub search
      if (codeKeys.length > 0) {
        scraperLogger.always(`[SCRAPE] 🔍 Keys returned by enhanced GitHub search:`);
        codeKeys.slice(0, 3).forEach((key, i) => {
          scraperLogger.always(`[SCRAPE]   ${i + 1}. ${key.key.substring(0, 25)}... from ${key.source}`);
        });
      }

      const allScraped = codeKeys; // Only GitHub code search now
      scraperLogger.always(`[SCRAPE] Processing ${allScraped.length} keys for immediate database check...`);
      
      // Process keys in small batches and save immediately
      let duplicatesInThisBatch = 0;
      const IMMEDIATE_SAVE_BATCH_SIZE = 10; // Save every 10 keys found
      let pendingKeys: Array<{ key: string; source: string; sourceUrl: string }> = [];
      
      for (let i = 0; i < allScraped.length; i++) {
        const item = allScraped[i]!;
        
        // Quick database check for this single key
        const [potentialResults, workingResults] = await Promise.all([
          this.supabase
            .from('potential_keys')
            .select('api_key')
            .eq('api_key', item.key)
            .limit(1),
          this.supabase
            .from('working_gemini_keys')
            .select('api_key')
            .eq('api_key', item.key)
            .limit(1)
        ]);

        const existsInPotential = potentialResults.data && potentialResults.data.length > 0;
        const existsInWorking = workingResults.data && workingResults.data.length > 0;
        
        if (!existsInPotential && !existsInWorking) {
          // Key is truly new!
          const newKey = {
            key: item.key,
            source: item.source,
            sourceUrl: item.sourceUrl,
          };
          
          pendingKeys.push(newKey);
          newKeys.push(newKey);
          
          scraperLogger.always(`[SCRAPE] ✓ NEW key #${newKeys.length}: ${item.key.substring(0, 20)}... (not in DB)`);
          
          // Save immediately when we reach batch size
          if (pendingKeys.length >= IMMEDIATE_SAVE_BATCH_SIZE) {
            await this.saveKeysImmediately(pendingKeys);
            pendingKeys = []; // Clear the batch
          }
        } else {
          duplicatesInThisBatch++;
          this.seenKeys.add(item.key); // Add to memory to avoid checking again
          
          if (duplicatesInThisBatch <= 3) {
            scraperLogger.always(`[SCRAPE] ✗ Duplicate #${duplicatesInThisBatch}: ${item.key.substring(0, 20)}... (already in DB)`);
          }
        }
      }
      
      // Save any remaining keys
      if (pendingKeys.length > 0) {
        await this.saveKeysImmediately(pendingKeys);
      }
      
      scraperLogger.always(`[SCRAPE] ━━━ Result: ${newKeys.length} NEW keys saved immediately, ${duplicatesInThisBatch} duplicates ━━━`);

      this.stats.totalScraped += newKeys.length;
      this.stats.duplicates += duplicatesInThisBatch;

      if (newKeys.length > 0) {
        scraperLogger.always(`[SCRAPE] ✓ Found and saved ${newKeys.length} NEW keys immediately, ${duplicatesInThisBatch} duplicates skipped`);
      } else if (duplicatesInThisBatch > 0) {
        scraperLogger.always(`[SCRAPE] Found 0 new keys, ${duplicatesInThisBatch} duplicates (all already in database)`);
      } else {
        scraperLogger.always(`[SCRAPE] Found 0 keys this iteration (GitHub returned no results or search queries exhausted)`);
      }

    } catch (error: any) {
      scraperLogger.error(`[SCRAPE] Error in scrape phase: ${error.message}`);
      if (error.message?.includes('403') || error.message?.includes('rate limit')) {
        throw new Error('rate limit');
      }
      throw error;
    }

    return newKeys;
  }

  private async saveKeysImmediately(keys: Array<{ key: string; source: string; sourceUrl: string }>): Promise<void> {
    if (keys.length === 0) return;
    
    try {
      scraperLogger.always(`[SAVE] 💾 Saving ${keys.length} keys immediately to database...`);
      
      // Prepare data for database insertion (align with potential_keys schema)
      const keysToInsert = keys.map(k => ({
        api_key: k.key,
        source: k.source,
        source_url: k.sourceUrl,
        found_at: new Date().toISOString(),
        validated: false
      }));
      
      // Insert into potential_keys table
      const { error } = await this.supabase
        .from('potential_keys')
        .insert(keysToInsert);
        
      if (error) {
        scraperLogger.error(`[SAVE] ❌ Error saving keys: ${error.message}`);
        return;
      }
      
      // Update stats
      this.stats.totalSaved += keys.length;
      
      // Add keys to seenKeys to prevent re-processing
      keys.forEach(k => this.seenKeys.add(k.key));
      
      scraperLogger.always(`[SAVE] ✅ Successfully saved ${keys.length} keys to database. Total saved: ${this.stats.totalSaved}`);
      
      // Log sample of saved keys
      if (keys.length > 0) {
        keys.slice(0, 3).forEach((key, i) => {
          scraperLogger.always(`[SAVE]   ${i + 1}. ${key.key.substring(0, 25)}... from ${key.source}`);
        });
      }
      
    } catch (error: any) {
      scraperLogger.error(`[SAVE] ❌ Exception saving keys: ${error.message}`);
    }
  }

  // keep for future use
  // private async savePhase(keys: Array<{ key: string; source: string; sourceUrl: string }>) {
    /* if (keys.length === 0) {
      scraperLogger.always(`[SAVE] No keys to save`);
      return;
    }

    scraperLogger.always(`[SAVE] Saving ${keys.length} keys to potential_keys table (database will handle duplicates)`);
    
    // Use larger batches since we're not checking duplicates - database handles it
    const batches = chunk(keys, 100);
    let totalErrors = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      scraperLogger.always(`[SAVE] Batch ${i + 1}/${batches.length}: Inserting ${batch.length} keys...`);

      try {
        // Use INSERT with onConflict - more efficient than UPSERT
        // Database handles duplicates via UNIQUE constraint
        const { error, count } = await this.supabase
          .from('potential_keys')
          .insert(
            batch.map(item => ({
              api_key: item.key,
              source: item.source,
              source_url: item.sourceUrl,
              validated: false,
              found_at: new Date().toISOString(),
            })),
            {
              count: 'exact'
            }
          );

        if (error) {
          // Check if it's a unique constraint violation (expected for duplicates)
          if (error.code === '23505') {
            // Duplicate key - this is EXPECTED and FINE
            scraperLogger.always(`[SAVE] ✓ Batch ${i + 1}/${batches.length}: Some/all keys already exist (database prevented duplicates)`);
          } else if (error.code === '42P01' || error.message.includes('does not exist')) {
            // Table doesn't exist
            scraperLogger.error(`[SAVE] ⚠⚠⚠ TABLE 'potential_keys' DOES NOT EXIST! ⚠⚠⚠`);
            scraperLogger.error(`[SAVE] You need to run the migration: npx supabase db push`);
            scraperLogger.error(`[SAVE] See: supabase/migrations/20250118000000_final_clean_key_tables.sql`);
            totalErrors += batch.length;
          } else {
            // Some other error
            scraperLogger.error(`[SAVE] ✗ Error saving batch ${i + 1}: ${error.message}`);
            scraperLogger.error(`[SAVE] Error code: ${error.code}, Details: ${JSON.stringify(error.details)}`);
            totalErrors += batch.length;
          }
        } else {
          // Success - count tells us how many were inserted
          const inserted = count || batch.length;
          this.stats.totalSaved += inserted;
          
          scraperLogger.always(`[SAVE] ✓ Batch ${i + 1}/${batches.length}: ${inserted} keys inserted successfully`);
          
          // Add to seenKeys so we don't check them again in this session
          batch.forEach(item => this.seenKeys.add(item.key));
        }
      } catch (error: any) {
        scraperLogger.error(`[SAVE] ✗ Exception saving batch ${i + 1}: ${error.message}`);
        scraperLogger.error(`[SAVE] Stack: ${error.stack}`);
        totalErrors += batch.length;
      }

      // Small delay between batches to avoid overwhelming the database
      if (i < batches.length - 1) {
        await delay(200);
      }
    }

    if (totalErrors > 0) {
      scraperLogger.error(`[SAVE] ⚠ Completed with ${totalErrors} errors - those keys will be retried next iteration`);
    } else {
      scraperLogger.always(`[SAVE] ✓ All batches processed successfully - ${this.stats.totalSaved} total keys in database`);
    }
  }
*/
}

/**
 * Key Processor Service
 */
class KeyProcessorService {
  private running = false;
  private stats: ProcessorStats;
  private supabase;
  private config: ProcessorConfig;

  constructor(config?: Partial<ProcessorConfig>) {
    this.config = {
      batchSize: 10,
      delayBetweenKeys: 2000,
      continuousProcessing: true,
      cycleCooldown: 30000,
      ...config
    };
    this.supabase = getSupabaseClient();
    this.stats = {
      startTime: new Date(),
      totalProcessed: 0,
      validKeys: 0,
      invalidKeys: 0,
      quotaKeys: 0,
      errors: 0,
      currentKey: null,
      currentPhase: 'idle',
      lastActivity: new Date(),
    };
  }

  async start() {
    if (this.running) return;

    this.running = true;
    this.stats.startTime = new Date();

    processorLogger.always('Starting key processor');

    try {
      await this.testConnection();
      await this.processLoop();
    } catch (error: any) {
      processorLogger.error(`Failed to start: ${error.message}`);
      this.running = false;
    }
  }

  stop() {
    this.running = false;
    processorLogger.always(`Stopped. Processed: ${this.stats.totalProcessed}, valid: ${this.stats.validKeys}`);
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): ProcessorStats {
    return { ...this.stats };
  }

  private async testConnection() {
    const [potentialTest, workingTest] = await Promise.all([
      this.supabase.from('potential_keys').select('id').limit(1),
      this.supabase.from('working_gemini_keys').select('id').limit(1),
    ]);

    if (potentialTest.error || workingTest.error) {
      throw new Error('Database tables not accessible');
    }
  }

  private async processLoop() {
    let cycle = 0;

    while (this.running) {
      cycle++;
      processorLogger.always(`[PROCESS] === Cycle ${cycle} Starting ===`);

      try {
        processorLogger.always(`[PROCESS] Fetching unvalidated keys (batch size: ${this.config.batchSize})`);

        const { data: pendingKeys, error } = await this.supabase
          .from('potential_keys')
          .select('*')
          .eq('validated', false)
          .order('found_at', { ascending: true })
          .limit(this.config.batchSize);

        if (error) {
          processorLogger.error(`[PROCESS] Error fetching keys: ${error.message}`);
          processorLogger.error(`[PROCESS] Error details: ${JSON.stringify(error)}`);
          await delay(10000);
          continue;
        }

        if (!pendingKeys || pendingKeys.length === 0) {
          processorLogger.always(`[PROCESS] No unvalidated keys found, waiting ${this.config.cycleCooldown / 1000}s`);
          await delay(this.config.cycleCooldown);
          continue;
        }

        processorLogger.always(`[PROCESS] Found ${pendingKeys.length} unvalidated keys to process`);

        for (let i = 0; i < pendingKeys.length; i++) {
          const keyRecord = pendingKeys[i];
          if (!this.running) break;

          this.stats.currentKey = keyRecord.api_key.slice(-8);
          this.stats.lastActivity = new Date();

          processorLogger.always(`[PROCESS] Validating key ${i + 1}/${pendingKeys.length}: ${keyRecord.api_key.substring(0, 12)}...`);
          await this.processKey(keyRecord);
          processorLogger.always(`[PROCESS] Validation ${i + 1}/${pendingKeys.length} complete`);

          await delay(this.config.delayBetweenKeys);
        }

        processorLogger.always(`[PROCESS] === Cycle ${cycle} Complete ===`);
        processorLogger.always(`[PROCESS] Stats: ${this.stats.totalProcessed} processed, ${this.stats.validKeys} valid, ${this.stats.invalidKeys} invalid`);

        if (!this.config.continuousProcessing) break;

        await delay(this.config.cycleCooldown);

      } catch (error: any) {
        processorLogger.error(`[PROCESS] Error in loop: ${error.message}`);
        processorLogger.error(`[PROCESS] Stack: ${error.stack}`);
        await delay(10000);
      }
    }

    this.running = false;
    processorLogger.always(`[PROCESS] Processor stopped`);
  }

  private async processKey(keyRecord: any) {
    const keyPreview = keyRecord.api_key.substring(0, 12);

    try {
      processorLogger.always(`[VALIDATE] Starting validation for key: ${keyPreview}...`);

      processorLogger.always(`[VALIDATE] Testing key against Gemini models...`);
      const validationResult = await validateGeminiKey(keyRecord.api_key);
      this.stats.totalProcessed++;

      processorLogger.always(`[VALIDATE] Validation complete - isValid: ${validationResult.isValid}, models: ${validationResult.totalModelsAccessible}/${validationResult.totalModelsTested}`);

      // Store validation result (this moves valid/quota_exceeded keys to working_gemini_keys)
      processorLogger.always(`[VALIDATE] Storing validation result to database...`);
      await storeValidationResult(validationResult);
      processorLogger.always(`[VALIDATE] ✓ Validation result stored`);

      if (validationResult.isValid || validationResult.status?.includes('quota')) {
        this.stats.validKeys++;
        const status = (validationResult.status === 'quota_reached' || validationResult.status === 'quota_exceeded') ? 'QUOTA EXCEEDED' : 'VALID';
        processorLogger.always(`[VALIDATE] ✓ Key is ${status} - Moved to working_gemini_keys table`);
        if (validationResult.status === 'quota_reached' || validationResult.status === 'quota_exceeded') {
          this.stats.quotaKeys++;
        }
      } else {
        this.stats.invalidKeys++;
        processorLogger.warn(`[VALIDATE] ✗ Key is INVALID - Marked as validated but not added to working keys`);
      }

      processorLogger.always(`[VALIDATE] Key ${keyPreview}... processed successfully`);

    } catch (error: any) {
      this.stats.errors++;
      processorLogger.error(`[VALIDATE] ✗ Error processing key ${keyPreview}...: ${error.message}`);
      processorLogger.error(`[VALIDATE] Stack: ${error.stack}`);
    }
  }
}

/**
 * Continuous Validator Service
 */
class KeyValidatorService {
  private running = false;
  private stats: ValidatorStats;
  private supabase;
  private config: ValidatorConfig;

  constructor(config?: Partial<ValidatorConfig>) {
    this.config = {
      batchSize: 10,
      delayBetweenKeys: 2000,
      deleteInvalidKeys: true,
      keepQuotaKeys: true,
      continuousValidation: true,
      cycleCooldown: 300000,
      ...config
    };
    this.supabase = getSupabaseClient();
    this.stats = {
      startTime: new Date(),
      totalProcessed: 0,
      stillValid: 0,
      becameInvalid: 0,
      quotaReached: 0,
      keysDeleted: 0,
      currentKey: null,
      currentPhase: 'idle',
      lastActivity: new Date(),
    };
  }

  async start() {
    if (this.running) return;

    this.running = true;
    this.stats.startTime = new Date();

    validatorLogger.always('Starting continuous validator');

    await this.validationLoop();
  }

  stop() {
    this.running = false;
    validatorLogger.always(`Stopped. Validated: ${this.stats.totalProcessed}, deleted: ${this.stats.keysDeleted}`);
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): ValidatorStats {
    return { ...this.stats };
  }

  private async validationLoop() {
    let cycle = 0;

    while (this.running) {
      cycle++;
      validatorLogger.always(`[REVALIDATOR] === Cycle ${cycle} Starting ===`);

      try {
        // Get keys that need revalidation (next_check_at is null or passed)
        validatorLogger.always(`[REVALIDATOR] Fetching keys needing revalidation...`);
        const { data: allKeys, error } = await this.supabase
          .from('working_gemini_keys')
          .select('id, api_key, status, last_validated_at, next_check_at')
          .or(`next_check_at.is.null,next_check_at.lte.${new Date().toISOString()}`)
          .order('last_validated_at', { ascending: true })
          .limit(this.config.batchSize * 5); // Get more keys since we process in batches

        if (error) {
          validatorLogger.error(`[REVALIDATOR] Error fetching keys: ${error.message}`);
          await delay(30000);
          continue;
        }

        if (!allKeys || allKeys.length === 0) {
          validatorLogger.always(`[REVALIDATOR] No keys need revalidation yet, waiting ${this.config.cycleCooldown / 1000}s`);
          await delay(this.config.cycleCooldown);
          continue;
        }

        validatorLogger.always(`[REVALIDATOR] Found ${allKeys.length} keys needing revalidation`);
        const batches = chunk(allKeys, this.config.batchSize);
        
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
          const batch = batches[batchIdx]!;
          if (!this.running) break;

          validatorLogger.always(`[REVALIDATOR] Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} keys)`);

          // Parallelize validation within the batch to speed up processing
          await Promise.allSettled(
            batch.map(async (keyRecord, i) => {
              if (!this.running) return;
              this.stats.currentKey = (keyRecord as any).api_key.slice(-8);
              this.stats.lastActivity = new Date();
              validatorLogger.always(`[REVALIDATOR] Revalidating key ${i + 1}/${batch.length}: ${keyRecord.api_key.substring(0, 12)}...`);
              await this.validateAndUpdate(keyRecord);
            })
          );

          validatorLogger.always(`[REVALIDATOR] Batch ${batchIdx + 1}/${batches.length} complete`);
        }

        validatorLogger.always(`[REVALIDATOR] === Cycle ${cycle} Complete ===`);
        validatorLogger.always(`[REVALIDATOR] Stats: ${this.stats.totalProcessed} processed, ${this.stats.stillValid} still valid, ${this.stats.becameInvalid} became invalid`);

        if (!this.config.continuousValidation) break;

        validatorLogger.always(`[REVALIDATOR] Waiting ${this.config.cycleCooldown / 1000}s until next cycle`);
        await delay(this.config.cycleCooldown);

      } catch (error: any) {
        validatorLogger.error(`[REVALIDATOR] Error in loop: ${error.message}`);
        validatorLogger.error(`[REVALIDATOR] Stack: ${error.stack}`);
        await delay(10000);
      }
    }

    this.running = false;
    validatorLogger.always(`[REVALIDATOR] Validator stopped`);
  }

  private async validateAndUpdate(keyRecord: any) {
    const keyPreview = keyRecord.api_key.substring(0, 12);
    
    try {
      const result = await validateGeminiKey(keyRecord.api_key);
      this.stats.totalProcessed++;

      const isQuotaExceeded = result.status === 'quota_reached' || result.status === 'quota_exceeded';
      const isValid = result.isValid;

      if (isValid && !isQuotaExceeded) {
        this.stats.stillValid++;
        validatorLogger.always(`[REVALIDATOR] ✓ Key ${keyPreview}... is still VALID`);
        await this.updateKey(keyRecord.api_key, 'valid');
      } else if (isQuotaExceeded) {
        this.stats.quotaReached++;
        validatorLogger.warn(`[REVALIDATOR] ⚠ Key ${keyPreview}... has QUOTA EXCEEDED`);
        await this.updateKey(keyRecord.api_key, 'quota_exceeded');
      } else {
        this.stats.becameInvalid++;
        validatorLogger.error(`[REVALIDATOR] ✗ Key ${keyPreview}... became INVALID`);
        
        if (this.config.deleteInvalidKeys) {
          await this.deleteKey(keyRecord.api_key);
          this.stats.keysDeleted++;
          validatorLogger.always(`[REVALIDATOR] Deleted invalid key ${keyPreview}...`);
        } else {
          validatorLogger.always(`[REVALIDATOR] Keeping invalid key ${keyPreview}... (deleteInvalidKeys=false)`);
        }
      }

    } catch (error: any) {
      validatorLogger.error(`[REVALIDATOR] Error validating key ${keyPreview}...: ${error.message}`);
    }
  }

  private async updateKey(apiKey: string, status: 'valid' | 'quota_exceeded') {
    try {
      const nextCheck = new Date(Date.now() + this.config.cycleCooldown);
      
      await this.supabase
        .from('working_gemini_keys')
        .update({
          status,
          last_validated_at: new Date().toISOString(),
          next_check_at: nextCheck.toISOString(),
        })
        .eq('api_key', apiKey);
    } catch (error: any) {
      validatorLogger.error(`Error updating key: ${error.message}`);
    }
  }

  private async deleteKey(apiKey: string) {
    try {
      await this.supabase
        .from('working_gemini_keys')
        .delete()
        .eq('api_key', apiKey);
    } catch (error: any) {
      validatorLogger.error(`Error deleting key: ${error.message}`);
    }
  }
}

// Singleton instances
let scraperInstance: KeyScraperService | null = null;
let processorInstance: KeyProcessorService | null = null;
let validatorInstance: KeyValidatorService | null = null;

export function getScraperService(config?: Partial<ScraperConfig>): KeyScraperService {
  if (!scraperInstance) {
    scraperInstance = new KeyScraperService(config);
  }
  return scraperInstance;
}

export function getProcessorService(config?: Partial<ProcessorConfig>): KeyProcessorService {
  if (!processorInstance) {
    processorInstance = new KeyProcessorService(config);
  }
  return processorInstance;
}

export function getValidatorService(config?: Partial<ValidatorConfig>): KeyValidatorService {
  if (!validatorInstance) {
    validatorInstance = new KeyValidatorService(config);
  }
  return validatorInstance;
}
