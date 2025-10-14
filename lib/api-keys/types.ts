/**
 * Shared type definitions for API key management
 */

export interface ApiKeyRecord {
  id: string;
  api_key: string;
  source: string;
  source_url: string | null;
  status: 'pending' | 'valid' | 'quota_reached' | 'invalid' | 'expired';
  quota_remaining: number | null;
  last_validated_at: string | null;
  last_used_at: string | null;
  error_count: number;
  success_count: number;
}

export interface ScrapedKey {
  key: string;
  sourceUrl: string;
  source: 'github' | 'gitlab' | 'pastebin';
  foundAt: Date;
  metadata?: {
    filename?: string;
    repository?: string;
    language?: string;
    lastModified?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  quotaRemaining?: number;
  error?: string;
  status: 'valid' | 'invalid' | 'quota_reached' | 'expired';
}

export interface ScraperConfig {
  batchSize: number;
  rateLimitCooldown: number;
  continuousScraping: boolean;
  maxDuration?: number;
}

export interface ValidatorConfig {
  batchSize: number;
  delayBetweenKeys: number;
  deleteInvalidKeys: boolean;
  keepQuotaKeys: boolean;
  continuousValidation: boolean;
  cycleCooldown: number;
}

export interface ProcessorConfig {
  batchSize: number;
  delayBetweenKeys: number;
  continuousProcessing: boolean;
  cycleCooldown: number;
}

export interface ServiceStats {
  startTime: Date;
  totalProcessed: number;
  currentPhase: string;
  lastActivity: Date;
}

export interface ScraperStats extends ServiceStats {
  totalScraped: number;
  totalSaved: number;
  duplicates: number;
  rateLimitHits: number;
}

export interface ValidatorStats extends ServiceStats {
  stillValid: number;
  becameInvalid: number;
  quotaReached: number;
  keysDeleted: number;
  currentKey: string | null;
}

export interface ProcessorStats extends ServiceStats {
  validKeys: number;
  invalidKeys: number;
  quotaKeys: number;
  errors: number;
  currentKey: string | null;
}
