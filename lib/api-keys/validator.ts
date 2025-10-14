/**
 * Gemini API Key Validator
 * Tests API keys across multiple Gemini models to determine capabilities
 */

import type { ScrapedKey } from './types';
import { createLogger } from './utils';

const logger = createLogger('VALIDATOR');

export interface ModelCapability {
  modelName: string;
  isAccessible: boolean;
  responseTime?: number;
  errorCode?: string;
  errorMessage?: string;
  maxTokens?: number;
  features?: string[];
}

export interface KeyValidationResult {
  key: string;
  isValid: boolean;
  validatedAt: Date;
  capabilities: ModelCapability[];
  totalModelsAccessible: number;
  totalModelsTested: number;
  averageResponseTime?: number | undefined;
  quotaRemaining?: number;
  rateLimitInfo?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
  // Derived status for downstream processors
  status?: 'valid' | 'quota_exceeded' | 'quota_reached' | 'invalid';
}

// Current Gemini models based on latest documentation
const GEMINI_MODELS = [
  // Gemini 2.5 Pro Series
  {
    name: 'gemini-2.5-pro',
    endpoint: 'generateContent',
    features: ['text', 'images', 'video', 'audio', 'pdf', 'code-execution', 'function-calling', 'search-grounding'],
    maxTokens: 1048576
  },
  {
    name: 'gemini-2.5-pro-preview-tts',
    endpoint: 'generateContent',
    features: ['text-to-speech', 'audio-generation'],
    maxTokens: 8000
  },

  // Gemini 2.5 Flash Series
  {
    name: 'gemini-2.5-flash',
    endpoint: 'generateContent',
    features: ['text', 'images', 'video', 'audio', 'code-execution', 'function-calling'],
    maxTokens: 1048576
  },
  {
    name: 'gemini-2.5-flash-image',
    endpoint: 'generateContent',
    features: ['image-generation'],
    maxTokens: 32768
  },
  {
    name: 'gemini-2.5-flash-live',
    endpoint: 'generateContent',
    features: ['live-api', 'audio-generation', 'function-calling', 'native-audio'],
    maxTokens: 128000
  },

  // Gemini 2.5 Flash-Lite Series
  {
    name: 'gemini-2.5-flash-lite',
    endpoint: 'generateContent',
    features: ['text', 'images', 'video', 'audio', 'pdf', 'high-throughput', 'cost-efficient'],
    maxTokens: 1048576
  }
];

/**
 * Test a single model with an API key
 */
async function testModelAccess(
  apiKey: string,
  model: typeof GEMINI_MODELS[0]
): Promise<ModelCapability> {
  const startTime = Date.now();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:${model.endpoint}?key=${apiKey}`;

    const testPayload = {
      contents: [{
        parts: [{
          text: "Hello"
        }]
      }],
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0.1
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      // Successful response; body not needed for capability detection
      await response.json().catch(() => undefined);

      return {
        modelName: model.name,
        isAccessible: true,
        responseTime,
        maxTokens: model.maxTokens,
        features: model.features
      };
    } else {
      const errorData = await response.json().catch(() => ({}));

      return {
        modelName: model.name,
        isAccessible: false,
        responseTime,
        errorCode: response.status.toString(),
        errorMessage: errorData.error?.message || `HTTP ${response.status}`,
        maxTokens: model.maxTokens,
        features: model.features
      };
    }
  } catch (error: any) {
    return {
      modelName: model.name,
      isAccessible: false,
      responseTime: Date.now() - startTime,
      errorCode: 'NETWORK_ERROR',
      errorMessage: error.message,
      maxTokens: model.maxTokens,
      features: model.features
    };
  }
}

/**
 * Get API key quota information
 */
async function getQuotaInfo(apiKey: string): Promise<{
  quotaRemaining?: number;
  rateLimitInfo?: { requestsPerMinute?: number; requestsPerDay?: number; };
}> {
  try {
    // Try to get quota from the models list endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );

    if (response.ok) {
      const rpmStr = response.headers.get('x-ratelimit-requests-per-minute');
      const rpdStr = response.headers.get('x-ratelimit-requests-per-day');
      const qrStr = response.headers.get('x-quota-remaining');

      const rateLimitInfo: { requestsPerMinute?: number; requestsPerDay?: number } = {};
      if (rpmStr) rateLimitInfo.requestsPerMinute = parseInt(rpmStr);
      if (rpdStr) rateLimitInfo.requestsPerDay = parseInt(rpdStr);

      const result: { quotaRemaining?: number; rateLimitInfo?: { requestsPerMinute?: number; requestsPerDay?: number } } = {};
      const qr = qrStr ? parseInt(qrStr) : NaN;
      if (!Number.isNaN(qr)) result.quotaRemaining = qr;
      if (Object.keys(rateLimitInfo).length > 0) result.rateLimitInfo = rateLimitInfo;

      return result;
    }
  } catch (error) {
    logger.warn(`Failed to get quota info: ${error}`);
  }

  return {};
}

/**
 * Validate an API key across all Gemini models
 */
export async function validateGeminiKey(apiKey: string): Promise<KeyValidationResult> {
  logger.always(`Validating key: ${apiKey.substring(0, 12)}...`);

  const capabilities: ModelCapability[] = [];
  const responseTimes: number[] = [];

  // Test multiple models in parallel to speed up validation, with a small safety gap
  const modelResults = await Promise.allSettled(
    GEMINI_MODELS.map((model) => testModelAccess(apiKey, model))
  );
  for (const res of modelResults) {
    if (res.status === 'fulfilled') {
      const capability = res.value;
      capabilities.push(capability);
      if (capability.responseTime) responseTimes.push(capability.responseTime);
    } else {
      // Network or model error – record as inaccessible for robustness
      capabilities.push({ modelName: 'unknown', isAccessible: false });
    }
  }

  // Get quota information
  const quotaInfo = await getQuotaInfo(apiKey);

  const accessibleModels = capabilities.filter(c => c.isAccessible);
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : undefined;

  const isValid = accessibleModels.length > 0;
  // Determine status field for downstream consumers
  const status: 'valid' | 'quota_exceeded' | 'quota_reached' | 'invalid' =
    typeof quotaInfo.quotaRemaining === 'number' && quotaInfo.quotaRemaining === 0
      ? 'quota_reached'
      : isValid
        ? 'valid'
        : 'invalid';

  const result: KeyValidationResult = {
    key: apiKey,
    isValid,
    validatedAt: new Date(),
    capabilities,
    totalModelsAccessible: accessibleModels.length,
    totalModelsTested: GEMINI_MODELS.length,
    averageResponseTime,
    ...quotaInfo,
    status
  };

  logger.always(`Key validation complete: ${accessibleModels.length}/${GEMINI_MODELS.length} models accessible`);

  return result;
}

/**
 * Validate multiple keys with progress tracking
 */
export async function validateKeys(
  keys: ScrapedKey[],
  onProgress?: (current: number, total: number, currentKey: string) => void
): Promise<KeyValidationResult[]> {
  const results: KeyValidationResult[] = [];

  logger.always(`Starting validation of ${keys.length} keys`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    onProgress?.(i + 1, keys.length, key.key.substring(0, 12) + '...');

    try {
      const result = await validateGeminiKey(key.key);
      results.push(result);

      // Delay between keys to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      logger.error(`Failed to validate key ${key.key.substring(0, 12)}...: ${error}`);
    }
  }

  const validKeys = results.filter(r => r.isValid);
  logger.always(`Validation complete: ${validKeys.length}/${keys.length} keys are valid`);

  return results;
}

/**
 * Get detailed capability summary
 */
export function getCapabilitySummary(validationResult: KeyValidationResult): {
  canGenerateText: boolean;
  canGenerateImages: boolean;
  canProcessVideo: boolean;
  canProcessAudio: boolean;
  canExecuteCode: boolean;
  canCallFunctions: boolean;
  canSearchGrounding: boolean;
  maxTokenLimit: number;
  bestModel: string;
} {
  const accessibleCapabilities = validationResult.capabilities.filter(c => c.isAccessible);

  const hasFeature = (feature: string) =>
    accessibleCapabilities.some(c => c.features?.includes(feature));

  const maxTokenLimit = Math.max(...accessibleCapabilities.map(c => c.maxTokens || 0));

  const bestModel = accessibleCapabilities
    .sort((a, b) => (b.maxTokens || 0) - (a.maxTokens || 0))[0]?.modelName || '';

  return {
    canGenerateText: hasFeature('text'),
    canGenerateImages: hasFeature('image-generation'),
    canProcessVideo: hasFeature('video'),
    canProcessAudio: hasFeature('audio') || hasFeature('native-audio'),
    canExecuteCode: hasFeature('code-execution'),
    canCallFunctions: hasFeature('function-calling'),
    canSearchGrounding: hasFeature('search-grounding'),
    maxTokenLimit,
    bestModel
  };
}
