/**
 * Initialize GitHub Tokens from Environment Variables
 * Migrates tokens from env vars to database on startup
 */

import { addGitHubToken, getAllGitHubTokens } from './github-token-manager';
import { createLogger } from './utils';

const logger = createLogger('TOKEN-INIT');

export async function initializeGitHubTokens(): Promise<void> {
  try {
    logger.always('Initializing GitHub tokens from environment...');

    const envTokens = [
      { name: 'GITHUB_TOKEN', value: process.env.GITHUB_TOKEN },
      { name: 'GITHUB_TOKEN_1', value: process.env.GITHUB_TOKEN_1 },
      { name: 'GITHUB_TOKEN_2', value: process.env.GITHUB_TOKEN_2 },
      { name: 'GITHUB_TOKEN_3', value: process.env.GITHUB_TOKEN_3 },
      { name: 'GITHUB_TOKEN_4', value: process.env.GITHUB_TOKEN_4 },
      { name: 'GITHUB_TOKEN_5', value: process.env.GITHUB_TOKEN_5 },
    ];

    // Get existing tokens from database
    const existingTokens = await getAllGitHubTokens();
    const existingNames = new Set(existingTokens.map(t => t.token_name));

    let added = 0;
    let skipped = 0;

    for (const { name, value } of envTokens) {
      if (!value) {
        continue; // Skip if not set in env
      }

      if (existingNames.has(name)) {
        skipped++;
        continue; // Already in database
      }

      const result = await addGitHubToken(name, value);
      if (result.success) {
        added++;
        logger.always(`[SUCCESS] Added GitHub token: ${name}`);
      } else {
        logger.error(`[ERROR] Failed to add ${name}: ${result.error}`);
      }
    }

    if (added > 0) {
      logger.always(`[SUCCESS] Initialized ${added} new GitHub token(s)`);
    }
    if (skipped > 0) {
      logger.always(`[INFO] Skipped ${skipped} existing token(s)`);
    }
    if (added === 0 && skipped === 0) {
      logger.warn('No GitHub tokens found in environment variables');
      logger.warn('Please set GITHUB_TOKEN in your .env file');
    }

    const totalTokens = existingTokens.length + added;
    logger.always(`[INFO] Total GitHub tokens available: ${totalTokens}`);

  } catch (error: any) {
    logger.error(`Failed to initialize GitHub tokens: ${error.message}`);
    throw error;
  }
}
