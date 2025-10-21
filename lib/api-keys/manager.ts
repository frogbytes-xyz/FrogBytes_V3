/**
 * API Key Manager
 * Manages the pool of Gemini API keys
 */

import { createClient } from '@supabase/supabase-js';
import { validateGeminiKey } from './validator';
import type { ApiKeyRecord } from './types';
import { delay } from './utils';
import { logger } from '../utils/logger';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type { ApiKeyRecord };

/**
 * Add a new API key
 */
export async function addApiKey(
  apiKey: string,
  source: string,
  sourceUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('api_keys')
      .insert({
        api_key: apiKey,
        source,
        source_url: sourceUrl,
        status: 'pending',
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Key already exists' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get an available API key
 */
export async function getAvailableKey(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('available_api_keys')
      .select('api_key')
      .limit(1)
      .single();

    if (error || !data) {
      return process.env.GEMINI_API_KEY || null;
    }

    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', data.api_key);

    return data.api_key;
  } catch (error: any) {
    return process.env.GEMINI_API_KEY || null;
  }
}

/**
 * Get multiple available keys
 */
export async function getAvailableKeys(count: number): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('available_api_keys')
      .select('api_key')
      .limit(count);

    if (error || !data || data.length === 0) {
      const fallbackKey = process.env.GEMINI_API_KEY;
      return fallbackKey ? [fallbackKey] : [];
    }

    const keys = data.map(row => row.api_key);

    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .in('api_key', keys);

    return keys;
  } catch (error: any) {
    const fallbackKey = process.env.GEMINI_API_KEY;
    return fallbackKey ? [fallbackKey] : [];
  }
}

/**
 * Mark key as successful
 */
export async function markKeySuccess(apiKey: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('api_keys')
      .update({
        status: 'valid',
        last_used_at: new Date().toISOString(),
      })
      .eq('api_key', apiKey);
  } catch (error: any) {
    logger.error('Error marking key success', error);
  }
}

/**
 * Mark key as failed
 */
export async function markKeyFailure(
  apiKey: string,
  status: 'quota_reached' | 'invalid' | 'expired'
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { data: currentKey } = await supabase
      .from('api_keys')
      .select('error_count')
      .eq('api_key', apiKey)
      .single();

    const errorCount = (currentKey?.error_count || 0) + 1;

    await supabase
      .from('api_keys')
      .update({
        status,
        error_count: errorCount,
        last_used_at: new Date().toISOString(),
      })
      .eq('api_key', apiKey);
  } catch (error: any) {
    logger.error('Error marking key failure', error);
  }
}

/**
 * Validate all pending and valid keys
 */
export async function validateAllKeys(): Promise<{
  validated: number;
  valid: number;
  invalid: number;
  quota_reached: number;
}> {
  try {
    const supabase = getSupabaseClient();
    
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, api_key')
      .in('status', ['pending', 'valid']);

    if (error || !keys || keys.length === 0) {
      return { validated: 0, valid: 0, invalid: 0, quota_reached: 0 };
    }

    const results = {
      validated: keys.length,
      valid: 0,
      invalid: 0,
      quota_reached: 0,
    };

    for (const key of keys) {
      const validation = await validateGeminiKey(key.api_key);

      await supabase
        .from('api_keys')
        .update({
          status: validation.status,
          last_validated_at: new Date().toISOString(),
          quota_remaining: validation.quotaRemaining,
        })
        .eq('id', key.id);

      if (validation.status === 'valid') results.valid++;
      else if (validation.status === 'quota_reached' || validation.status === 'quota_exceeded') results.quota_reached++;
      else results.invalid++;

      await delay(2000);
    }

    return results;
  } catch (error: any) {
    return { validated: 0, valid: 0, invalid: 0, quota_reached: 0 };
  }
}

/**
 * Get key pool statistics
 */
export async function getKeyPoolStats(): Promise<{
  total: number;
  valid: number;
  invalid: number;
  quota_reached: number;
  pending: number;
}> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('api_keys')
      .select('status');

    if (error || !data) {
      return { total: 0, valid: 0, invalid: 0, quota_reached: 0, pending: 0 };
    }

    const stats = {
      total: data.length,
      valid: 0,
      invalid: 0,
      quota_reached: 0,
      pending: 0,
    };

    for (const row of data) {
      if (row.status === 'valid') stats.valid++;
      else if (row.status === 'invalid' || row.status === 'expired') stats.invalid++;
      else if (row.status === 'quota_reached') stats.quota_reached++;
      else if (row.status === 'pending') stats.pending++;
    }

    return stats;
  } catch (error: any) {
    return { total: 0, valid: 0, invalid: 0, quota_reached: 0, pending: 0 };
  }
}
