/**
 * Database service for API key validation and storage
 * Uses the new clean 2-table system:
 * - potential_keys: Raw scraped keys (unvalidated)
 * - working_gemini_keys: Validated keys used by the app
 */

import { createClient } from '@supabase/supabase-js';
import type { ScrapedKey } from './types';
import type { KeyValidationResult } from './validator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role key for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface DatabasePotentialKey extends ScrapedKey {
  id: string;
  validated: boolean;
}

export interface DatabaseWorkingKey {
  id: string;
  api_key: string;
  status: 'valid' | 'quota_exceeded';
  source?: string;
  source_url?: string;
  models_accessible: string[];
  can_generate_text: boolean;
  can_generate_images: boolean;
  can_process_video: boolean;
  can_process_audio: boolean;
  can_execute_code: boolean;
  can_call_functions: boolean;
  max_tokens: number;
  best_model?: string;
  // Note: validation_result removed - validation tracking is in potential_keys.validated
  last_validated_at: Date;
  next_check_at?: Date;
  success_count: number;
  quota_count: number;
  error_count: number;
  added_at: Date;
  updated_at: Date;
}

/**
 * Store scraped keys in the potential_keys table
 */
export async function storeScrapedKeys(keys: ScrapedKey[]): Promise<void> {
  const { error } = await supabase
    .from('potential_keys')
    .upsert(
      keys.map(key => ({
        api_key: key.key,
        source: key.source,
        source_url: key.sourceUrl,
        metadata: key.metadata,
        found_at: key.foundAt,
        validated: false
      })),
      { onConflict: 'api_key' }
    );

  if (error) {
    throw new Error(`Failed to store scraped keys: ${error.message}`);
  }
}

/**
 * Get pending keys for validation from potential_keys
 */
export async function getPendingKeysForValidation(limit = 50): Promise<DatabasePotentialKey[]> {
  const { data, error } = await supabase
    .from('potential_keys')
    // Select with aliases to match ScrapedKey shape so downstream code can use key/sourceUrl/foundAt
    .select('id, key:api_key, source, sourceUrl:source_url, metadata, foundAt:found_at, validated')
    .eq('validated', false)
    .order('found_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get pending keys: ${error.message}`);
  }

  return (data as any) || [];
}

/**
 * Mark key as validated in potential_keys (after moving to working_gemini_keys)
 */
export async function markKeyAsValidated(apiKey: string): Promise<void> {
  const { error } = await supabase
    .from('potential_keys')
    .update({
      validated: true
    })
    .eq('api_key', apiKey);

  if (error) {
    throw new Error(`Failed to mark key as validated: ${error.message}`);
  }
}

/**
 * Store validation result and move key to working_gemini_keys if valid or quota_exceeded
 */
export async function storeValidationResult(validationResult: KeyValidationResult): Promise<void> {
  // Determine if quota is exceeded via either explicit status or quotaRemaining header
  const isQuotaExceeded = (
    validationResult.status === 'quota_reached' ||
    validationResult.status === 'quota_exceeded' ||
    (typeof validationResult.quotaRemaining === 'number' && validationResult.quotaRemaining === 0)
  );

  // If the key is invalid and not quota-exceeded, do not insert into working table
  if (!validationResult.isValid && !isQuotaExceeded) {
    await markKeyAsValidated(validationResult.key);
    return;
  }

  // Determine status for working_gemini_keys
  const status: 'quota_exceeded' | 'valid' = isQuotaExceeded ? 'quota_exceeded' : 'valid';

  // Extract capabilities
  const accessibleModels = validationResult.capabilities
    .filter(c => c.isAccessible)
    .map(c => c.modelName);

  const canGenerateText = validationResult.capabilities.some(
    c => c.isAccessible && c.features?.includes('text')
  );

  const canGenerateImages = validationResult.capabilities.some(
    c => c.isAccessible && c.features?.includes('image-generation')
  );

  const canProcessVideo = validationResult.capabilities.some(
    c => c.isAccessible && c.features?.includes('video')
  );

  const canProcessAudio = validationResult.capabilities.some(
    c => c.isAccessible && (c.features?.includes('audio') || c.features?.includes('native-audio'))
  );

  const canExecuteCode = validationResult.capabilities.some(
    c => c.isAccessible && c.features?.includes('code-execution')
  );

  const canCallFunctions = validationResult.capabilities.some(
    c => c.isAccessible && c.features?.includes('function-calling')
  );

  const maxTokens = Math.max(
    ...validationResult.capabilities
      .filter(c => c.isAccessible)
      .map(c => c.maxTokens || 0),
    0
  );

  const bestModel = validationResult.capabilities
    .filter(c => c.isAccessible)
    .sort((a, b) => (b.maxTokens || 0) - (a.maxTokens || 0))[0]?.modelName;

  // Get source info from potential_keys
  const { data: potentialKey } = await supabase
    .from('potential_keys')
    .select('source, source_url')
    .eq('api_key', validationResult.key)
    .single();

  // Insert or update in working_gemini_keys
  const { error: insertError } = await supabase
    .from('working_gemini_keys')
    .upsert({
      api_key: validationResult.key,
      status,
      source: potentialKey?.source,
      source_url: potentialKey?.source_url,
      models_accessible: accessibleModels,
      can_generate_text: canGenerateText,
      can_generate_images: canGenerateImages,
      can_process_video: canProcessVideo,
      can_process_audio: canProcessAudio,
      can_execute_code: canExecuteCode,
      can_call_functions: canCallFunctions,
      max_tokens: maxTokens,
      best_model: bestModel,
      // Note: validation_result column removed - validation tracking is in potential_keys.validated
      last_validated_at: new Date().toISOString(),
      next_check_at: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
    }, {
      onConflict: 'api_key'
    });

  if (insertError) {
    throw new Error(`Failed to store in working_gemini_keys: ${insertError.message}`);
  }

  // Mark as validated in potential_keys
  await markKeyAsValidated(validationResult.key);
}

/**
 * Store validation error (mark key as validated but don't move to working_gemini_keys)
 */
export async function storeValidationError(apiKey: string, _error: string): Promise<void> {
  await markKeyAsValidated(apiKey);
}

/**
 * Get validated working keys with capabilities
 */
export async function getValidatedKeys(filters?: {
  status?: 'valid' | 'quota_exceeded';
  canGenerateText?: boolean;
  canGenerateImages?: boolean;
  canProcessVideo?: boolean;
  canProcessAudio?: boolean;
  canExecuteCode?: boolean;
  canCallFunctions?: boolean;
  minTokens?: number;
  limit?: number;
}): Promise<DatabaseWorkingKey[]> {
  let query = supabase
    .from('working_gemini_keys')
    .select('*')
    .order('last_validated_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.canGenerateText !== undefined) {
    query = query.eq('can_generate_text', filters.canGenerateText);
  }

  if (filters?.canGenerateImages !== undefined) {
    query = query.eq('can_generate_images', filters.canGenerateImages);
  }

  if (filters?.canProcessVideo !== undefined) {
    query = query.eq('can_process_video', filters.canProcessVideo);
  }

  if (filters?.canProcessAudio !== undefined) {
    query = query.eq('can_process_audio', filters.canProcessAudio);
  }

  if (filters?.canExecuteCode !== undefined) {
    query = query.eq('can_execute_code', filters.canExecuteCode);
  }

  if (filters?.canCallFunctions !== undefined) {
    query = query.eq('can_call_functions', filters.canCallFunctions);
  }

  if (filters?.minTokens !== undefined) {
    query = query.gte('max_tokens', filters.minTokens);
  }

  if (filters?.limit !== undefined) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get validated keys: ${error.message}`);
  }

  return data || [];
}

/**
 * Get validation statistics
 */
export async function getValidationStats(): Promise<{
  totalScraped: number;
  totalValidated: number;
  totalValid: number;
  totalQuotaExceeded: number;
  pendingValidation: number;
  validationProgress: number;
  capabilityBreakdown: {
    canGenerateText: number;
    canGenerateImages: number;
    canProcessVideo: number;
    canProcessAudio: number;
    canExecuteCode: number;
    canCallFunctions: number;
  };
}> {
  const [potentialResult, workingResult] = await Promise.all([
    // Get total scraped keys
    supabase
      .from('potential_keys')
      .select('id, validated', { count: 'exact' }),

    // Get working keys
    supabase
      .from('working_gemini_keys')
      .select(`
        status,
        can_generate_text,
        can_generate_images,
        can_process_video,
        can_process_audio,
        can_execute_code,
        can_call_functions
      `)
  ]);

  const totalScraped = potentialResult.count || 0;
  const potentialKeys = potentialResult.data || [];
  const workingKeys = workingResult.data || [];

  const pendingValidation = potentialKeys.filter(k => !k.validated).length;
  const totalValidated = totalScraped - pendingValidation;
  const validationProgress = totalScraped > 0 ? (totalValidated / totalScraped) * 100 : 0;

  const totalValid = workingKeys.filter(k => k.status === 'valid').length;
  const totalQuotaExceeded = workingKeys.filter(k => k.status === 'quota_exceeded').length;

  // Calculate capability breakdown (only for valid keys)
  const validKeys = workingKeys.filter(k => k.status === 'valid');
  const capabilityBreakdown = {
    canGenerateText: validKeys.filter(k => k.can_generate_text).length,
    canGenerateImages: validKeys.filter(k => k.can_generate_images).length,
    canProcessVideo: validKeys.filter(k => k.can_process_video).length,
    canProcessAudio: validKeys.filter(k => k.can_process_audio).length,
    canExecuteCode: validKeys.filter(k => k.can_execute_code).length,
    canCallFunctions: validKeys.filter(k => k.can_call_functions).length,
  };

  return {
    totalScraped,
    totalValidated,
    totalValid,
    totalQuotaExceeded,
    pendingValidation,
    validationProgress,
    capabilityBreakdown
  };
}

/**
 * Get keys that need revalidation (for 5-minute validator)
 */
export async function getKeysNeedingRevalidation(limit = 50): Promise<DatabaseWorkingKey[]> {
  const { data, error } = await supabase
    .from('working_gemini_keys')
    .select('*')
    .or(`next_check_at.is.null,next_check_at.lte.${new Date().toISOString()}`)
    .order('last_validated_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get keys needing revalidation: ${error.message}`);
  }

  return data || [];
}

/**
 * Update key status and schedule next check
 */
export async function updateKeyStatus(
  apiKey: string,
  status: 'valid' | 'quota_exceeded',
  nextCheckMinutes = 5
): Promise<void> {
  const { error } = await supabase
    .from('working_gemini_keys')
    .update({
      status,
      last_validated_at: new Date().toISOString(),
      next_check_at: new Date(Date.now() + nextCheckMinutes * 60000).toISOString(),
    })
    .eq('api_key', apiKey);

  if (error) {
    throw new Error(`Failed to update key status: ${error.message}`);
  }
}

/**
 * Remove invalid key from working_gemini_keys
 */
export async function removeInvalidKey(apiKey: string): Promise<void> {
  const { error } = await supabase
    .from('working_gemini_keys')
    .delete()
    .eq('api_key', apiKey);

  if (error) {
    throw new Error(`Failed to remove invalid key: ${error.message}`);
  }
}

/**
 * Get enriched scraped keys (combination of potential_keys with validation status)
 */
export async function getEnrichedScrapedKeys(limit = 50, offset = 0): Promise<any[]> {
  const { data, error } = await supabase
    .from('potential_keys')
    .select('*')
    .order('found_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get enriched scraped keys: ${error.message}`);
  }

  return data || [];
}

/**
 * Mark key as currently being validated (to prevent concurrent validation)
 */
export async function markKeyAsValidating(apiKey: string): Promise<void> {
  // This could be implemented with a validation_status field if needed
  // For now, we'll just use the existing validated boolean
  console.log(`Marking key as validating: ${apiKey.substring(0, 12)}...`);
}