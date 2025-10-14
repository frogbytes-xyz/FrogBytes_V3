/**
 * GitHub Token Manager
 * Manages multiple GitHub API tokens with automatic rotation and rate limit handling
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface GitHubToken {
  id: string;
  token_name: string;
  token_value: string;
  is_active: boolean;
  rate_limit_remaining: number | null;
  rate_limit_reset_at: string | null;
  last_used_at: string | null;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
}

/**
 * Get all GitHub tokens from database
 */
export async function getAllGitHubTokens(): Promise<GitHubToken[]> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('github_tokens')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get GitHub tokens:', error);
    return [];
  }
}

/**
 * Get an available GitHub token (not rate limited)
 * Prioritizes tokens with highest remaining rate limit
 */
export async function getAvailableGitHubToken(): Promise<GitHubToken | null> {
  try {
    const supabase = getSupabaseClient();

    const now = new Date().toISOString();

    // First, try to get tokens that are not rate limited at all
    const { data: nonLimitedTokens, error: error1 } = await supabase
      .from('github_tokens')
      .select('*')
      .eq('is_active', true)
      .or(`rate_limit_reset_at.is.null,rate_limit_reset_at.lt.${now}`)
      .gt('rate_limit_remaining', 0)
      .order('rate_limit_remaining', { ascending: false })
      .limit(5);

    if (!error1 && nonLimitedTokens && nonLimitedTokens.length > 0) {
      // Return token with highest remaining rate limit
      return nonLimitedTokens[0];
    }

    // If no tokens with remaining rate limit, get any active token that's not rate limited
    const { data: availableTokens, error: error2 } = await supabase
      .from('github_tokens')
      .select('*')
      .eq('is_active', true)
      .or(`rate_limit_reset_at.is.null,rate_limit_reset_at.lt.${now}`)
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .limit(1);

    if (!error2 && availableTokens && availableTokens.length > 0) {
      return availableTokens[0];
    }

    return null;
  } catch (error) {
    console.error('Failed to get available GitHub token:', error);
    return null;
  }
}

/**
 * Get next available token for rotation (skips the current one)
 */
export async function getNextAvailableGitHubToken(currentTokenId?: string): Promise<GitHubToken | null> {
  try {
    const supabase = getSupabaseClient();

    const now = new Date().toISOString();

    let query = supabase
      .from('github_tokens')
      .select('*')
      .eq('is_active', true)
      .or(`rate_limit_reset_at.is.null,rate_limit_reset_at.lt.${now}`);

    // Exclude current token if provided
    if (currentTokenId) {
      query = query.neq('id', currentTokenId);
    }

    const { data, error } = await query
      .order('rate_limit_remaining', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0];
  } catch (error) {
    console.error('Failed to get next available GitHub token:', error);
    return null;
  }
}

/**
 * Get all available GitHub tokens (not rate limited)
 * Returns tokens sorted by remaining rate limit (highest first)
 */
export async function getAllAvailableGitHubTokens(): Promise<GitHubToken[]> {
  try {
    const supabase = getSupabaseClient();

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('github_tokens')
      .select('*')
      .eq('is_active', true)
      .or(`rate_limit_reset_at.is.null,rate_limit_reset_at.lt.${now}`)
      .order('rate_limit_remaining', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Failed to get available GitHub tokens:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get available GitHub tokens:', error);
    return [];
  }
}

/**
 * Update GitHub token stats after use
 */
export async function updateGitHubTokenStats(
  tokenId: string,
  success: boolean,
  rateLimitRemaining?: number,
  rateLimitResetAt?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase.rpc('update_github_token_stats', {
      p_token_id: tokenId,
      p_success: success,
      p_rate_limit_remaining: rateLimitRemaining || null,
      p_rate_limit_reset_at: rateLimitResetAt || null
    });
  } catch (error) {
    console.error('Failed to update GitHub token stats:', error);
  }
}

/**
 * Add a new GitHub token
 */
export async function addGitHubToken(
  tokenName: string,
  tokenValue: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();

    // Test token validity first
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenValue}`,
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      return { success: false, error: 'Invalid GitHub token' };
    }

    const { error } = await supabase
      .from('github_tokens')
      .insert({
        token_name: tokenName,
        token_value: tokenValue,
        is_active: true
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Token name already exists' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update GitHub token
 */
export async function updateGitHubToken(
  tokenId: string,
  updates: {
    token_name?: string;
    token_value?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();

    // If updating token value, test it first
    if (updates.token_value) {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${updates.token_value}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (!response.ok) {
        return { success: false, error: 'Invalid GitHub token' };
      }
    }

    const { error } = await supabase
      .from('github_tokens')
      .update(updates)
      .eq('id', tokenId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a GitHub token
 */
export async function deleteGitHubToken(tokenId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('github_tokens')
      .delete()
      .eq('id', tokenId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Initialize tokens from environment variables
 * This migrates from env vars to database
 */
export async function initializeTokensFromEnv(): Promise<void> {
  try {
    const envTokens = [
      { name: 'GITHUB_TOKEN', value: process.env.GITHUB_TOKEN },
      { name: 'GITHUB_TOKEN_1', value: process.env.GITHUB_TOKEN_1 },
      { name: 'GITHUB_TOKEN_2', value: process.env.GITHUB_TOKEN_2 },
      { name: 'GITHUB_TOKEN_3', value: process.env.GITHUB_TOKEN_3 },
      { name: 'GITHUB_TOKEN_4', value: process.env.GITHUB_TOKEN_4 },
      { name: 'GITHUB_TOKEN_5', value: process.env.GITHUB_TOKEN_5 },
    ];

    const existingTokens = await getAllGitHubTokens();
    const existingNames = new Set(existingTokens.map(t => t.token_name));

    for (const { name, value } of envTokens) {
      if (value && !existingNames.has(name)) {
        await addGitHubToken(name, value);
        console.log(`Initialized GitHub token: ${name}`);
      }
    }
  } catch (error) {
    console.error('Failed to initialize tokens from env:', error);
  }
}

/**
 * Get token statistics
 */
export async function getTokenStatistics(): Promise<{
  total: number;
  active: number;
  rateLimited: number;
  totalRequests: number;
  successRate: number;
}> {
  try {
    const tokens = await getAllGitHubTokens();
    const now = new Date();

    const stats = {
      total: tokens.length,
      active: tokens.filter(t => t.is_active).length,
      rateLimited: tokens.filter(t =>
        t.is_active &&
        t.rate_limit_reset_at &&
        new Date(t.rate_limit_reset_at) > now
      ).length,
      totalRequests: tokens.reduce((sum, t) => sum + t.total_requests, 0),
      successRate: 0
    };

    const totalRequests = stats.totalRequests;
    const successfulRequests = tokens.reduce((sum, t) => sum + t.successful_requests, 0);

    if (totalRequests > 0) {
      stats.successRate = (successfulRequests / totalRequests) * 100;
    }

    return stats;
  } catch (error) {
    console.error('Failed to get token statistics:', error);
    return {
      total: 0,
      active: 0,
      rateLimited: 0,
      totalRequests: 0,
      successRate: 0
    };
  }
}
