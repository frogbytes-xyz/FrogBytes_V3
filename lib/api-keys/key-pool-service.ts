/**
 * Unified API Key Pool Service
 * Manages Gemini API keys with intelligent rotation and validation
 *
 * This service:
 * 1. Provides keys for summary generation, quiz generation, and copilot
 * 2. Tracks key usage and automatically rotates keys
 * 3. Handles quota exceeded and invalid keys gracefully
 * 4. Integrates with the working_gemini_keys table
 */

import { createClient } from '@supabase/supabase-js';
import { createLogger } from './utils';

const logger = createLogger('KEY-POOL');

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface KeyWithCapabilities {
  api_key: string;
  can_generate_text: boolean;
  can_generate_images: boolean;
  best_model: string | null;
  max_tokens: number;
  last_validated_at: string;
}

/**
 * Get a valid key for text generation (summaries, quiz, copilot)
 * Uses intelligent rotation based on last usage and capabilities
 */
export async function getKeyForTextGeneration(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();

    // Get valid keys with text generation capability
    const { data, error } = await supabase
      .from('working_gemini_keys')
      .select('api_key, can_generate_text, last_validated_at, success_count, quota_count')
      .eq('status', 'valid')
      .eq('can_generate_text', true)
      .order('success_count', { ascending: false }) // Prefer keys with successful history
      .order('quota_count', { ascending: true }) // Avoid keys that hit quota often
      .limit(1)
      .single();

    if (error || !data) {
      logger.warn('No valid keys in pool, using fallback');
      return process.env.GEMINI_API_KEY || null;
    }

    logger.info(`Selected key for text generation: ${data.api_key.substring(0, 12)}...`);
    return data.api_key;
  } catch (error: any) {
    logger.error(`Error getting key: ${error.message}`);
    return process.env.GEMINI_API_KEY || null;
  }
}

/**
 * Get multiple valid keys for parallel processing
 * Used by summary generation for chunking
 */
export async function getKeysForParallelProcessing(count: number): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('working_gemini_keys')
      .select('api_key, can_generate_text, max_tokens, success_count, quota_count')
      .eq('status', 'valid')
      .eq('can_generate_text', true)
      .order('max_tokens', { ascending: false }) // Prefer higher token limits
      .order('success_count', { ascending: false })
      .limit(count);

    if (error || !data || data.length === 0) {
      const fallbackKey = process.env.GEMINI_API_KEY;
      return fallbackKey ? [fallbackKey] : [];
    }

    const keys = data.map(row => row.api_key);
    logger.info(`Selected ${keys.length} keys for parallel processing`);
    return keys;
  } catch (error: any) {
    logger.error(`Error getting keys for parallel processing: ${error.message}`);
    const fallbackKey = process.env.GEMINI_API_KEY;
    return fallbackKey ? [fallbackKey] : [];
  }
}

/**
 * Get a key for a specific model
 */
export async function getKeyForModel(modelName: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error} = await supabase
      .from('working_gemini_keys')
      .select('api_key, models_accessible, best_model, success_count')
      .eq('status', 'valid')
      .order('success_count', { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) {
      return process.env.GEMINI_API_KEY || null;
    }

    // Find a key that has access to the specific model
    for (const key of data) {
      const hasModel = key.models_accessible?.includes(modelName);

      if (hasModel) {
        logger.info(`Found key for model ${modelName}: ${key.api_key.substring(0, 12)}...`);
        return key.api_key;
      }
    }

    // Fallback: return any valid key
    logger.warn(`No specific key for model ${modelName}, using any valid key`);
  return data?.[0]?.api_key || null;
  } catch (error: any) {
    logger.error(`Error getting key for model: ${error.message}`);
    return process.env.GEMINI_API_KEY || null;
  }
}

/**
 * Mark a key as having quota exceeded
 * Updates status in working_gemini_keys
 */
export async function markKeyQuotaExceeded(apiKey: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase
      .from('working_gemini_keys')
      .update({
        status: 'quota_exceeded',
        quota_count: supabase.rpc('increment', { x: 1 }), // Increment counter
      })
      .eq('api_key', apiKey);

    logger.warn(`Marked key as quota exceeded: ${apiKey.substring(0, 12)}...`);
  } catch (error: any) {
    logger.error(`Error marking key quota exceeded: ${error.message}`);
  }
}

/**
 * Mark a key as invalid - removes it from working_gemini_keys
 */
export async function markKeyInvalid(apiKey: string, _errorMessage: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Remove from working keys
    await supabase
      .from('working_gemini_keys')
      .delete()
      .eq('api_key', apiKey);

    logger.warn(`Marked key as invalid and removed: ${apiKey.substring(0, 12)}...`);
  } catch (error: any) {
    logger.error(`Error marking key invalid: ${error.message}`);
  }
}

/**
 * Mark a key as successfully used
 * Updates the success count and last validated time
 */
export async function markKeySuccess(apiKey: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Increment success count
    const { data: key } = await supabase
      .from('working_gemini_keys')
      .select('success_count')
      .eq('api_key', apiKey)
      .single();

    if (key) {
      await supabase
        .from('working_gemini_keys')
        .update({
          success_count: (key.success_count || 0) + 1,
          last_validated_at: new Date().toISOString()
        })
        .eq('api_key', apiKey);

      logger.info(`Marked key as successful: ${apiKey.substring(0, 12)}...`);
    }
  } catch (error: any) {
    logger.error(`Error marking key success: ${error.message}`);
  }
}

/**
 * Get pool statistics
 */
export async function getPoolStats(): Promise<{
  totalScraped: number;
  totalValidated: number;
  validKeys: number;
  quotaExceededKeys: number;
  pendingValidation: number;
  textGenerationKeys: number;
  imageGenerationKeys: number;
}> {
  try {
    const supabase = getSupabaseClient();

    const [allPotentialRes, pendingPotentialRes, workingResult] = await Promise.all([
      supabase.from('potential_keys').select('id', { count: 'exact', head: true }),
      supabase.from('potential_keys').select('id', { count: 'exact', head: true }).eq('validated', false),
      supabase.from('working_gemini_keys').select(`
        id,
        status,
        can_generate_text,
        can_generate_images
      `)
    ]);

    const working = workingResult.data || [];
    const totalScraped = allPotentialRes.count || 0;
    const pendingValidation = pendingPotentialRes.count || 0;

    return {
      totalScraped,
      totalValidated: working.length, // Number of keys in working pool (validated and usable/quota)
      validKeys: working.filter(k => k.status === 'valid').length,
      quotaExceededKeys: working.filter(k => k.status === 'quota_exceeded').length,
      pendingValidation,
      textGenerationKeys: working.filter(k => k.status === 'valid' && k.can_generate_text).length,
      imageGenerationKeys: working.filter(k => k.status === 'valid' && k.can_generate_images).length
    };
  } catch (error: any) {
    logger.error(`Error getting pool stats: ${error.message}`);
    return {
      totalScraped: 0,
      totalValidated: 0,
      validKeys: 0,
      quotaExceededKeys: 0,
      pendingValidation: 0,
      textGenerationKeys: 0,
      imageGenerationKeys: 0
    };
  }
}

/**
 * Get detailed key information
 */
export async function getKeyDetails(apiKey: string): Promise<KeyWithCapabilities | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('working_gemini_keys')
      .select(`
        api_key,
        can_generate_text,
        can_generate_images,
        best_model,
        max_tokens,
        last_validated_at
      `)
      .eq('api_key', apiKey)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      api_key: data.api_key,
      can_generate_text: data.can_generate_text || false,
      can_generate_images: data.can_generate_images || false,
      best_model: data.best_model,
      max_tokens: data.max_tokens || 0,
      last_validated_at: data.last_validated_at
    };
  } catch (error: any) {
    logger.error(`Error getting key details: ${error.message}`);
    return null;
  }
}
