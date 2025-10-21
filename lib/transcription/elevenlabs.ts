import { logger } from '@/lib/utils/logger'

/**
 * ElevenLabs API Integration for Speech-to-Text
 * 
 * This module handles communication with the ElevenLabs API for transcription.
 * Supports both authenticated (with API key) and unauthenticated (free) endpoints.
 */

export interface TranscriptionResult {
  text: string
  language?: string
  durationSeconds?: number
  wordCount: number
  // ElevenLabs specific metadata
  languageCode?: string
  languageProbability?: number
  transcriptionId?: string
  words?: Array<{
    text: string
    start: number
    end: number
    type: 'word' | 'spacing' | 'audio_event'
    speaker_id?: string
    logprob?: number
  }>
  additionalFormats?: Array<{
    requested_format: string
    file_extension: string
    content_type: string
    is_base64_encoded: boolean
    content: string
  }>
}

export interface TranscriptionError {
  message: string
  code?: string
  statusCode?: number
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1/speech-to-text'
// Use scribe_v1 - this is the actual Speech-to-Text model (not TTS models!)
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'scribe_v1'

/**
 * Available ElevenLabs speech-to-text models
 */
export const ELEVENLABS_MODELS = {
  SCRIBE_V1: 'scribe_v1',                        // State-of-the-art speech recognition (FREE tier supported)
  SCRIBE_V1_EXPERIMENTAL: 'scribe_v1_experimental', // Experimental variant
} as const

/**
 * Transcribe audio file using ElevenLabs API
 * 
 * This function uses the ElevenLabs speech-to-text endpoint.
 * - If ELEVENLABS_API_KEY is provided, uses authenticated endpoint (higher quality & quota)
 * - Otherwise, uses free unauthenticated endpoint with allow_unauthenticated=1
 * 
 * @param filePath - Path to the audio file on disk
 * @param fileName - Original filename for context
 * @param useAuth - Whether to use authenticated endpoint (default: auto-detect based on API key)
 * @returns Transcription result with text and metadata
 */
export async function transcribeAudio(
  filePath: string,
  fileName: string,
  useAuth?: boolean
): Promise<TranscriptionResult> {
  const FormData = require('form-data')
  const { readFile } = await import('fs/promises')
  const { basename } = await import('path')
  const https = await import('https')
  
  // Auto-detect auth mode if not specified
  const shouldUseAuth = useAuth !== undefined ? useAuth : !!ELEVENLABS_API_KEY
  
  // Determine endpoint URL
  const apiUrl = shouldUseAuth 
    ? ELEVENLABS_BASE_URL 
    : `${ELEVENLABS_BASE_URL}?allow_unauthenticated=1`

  try {
    logger.info(`[ElevenLabs] Transcribing with ${shouldUseAuth ? 'authenticated' : 'free'} endpoint`)
    
    // Read the audio file
    const fileBuffer = await readFile(filePath)
    
    // Create proper FormData with form-data package (works in Node.js)
    const formData = new FormData()
    
    // Add model_id first (order may matter for some APIs)
    formData.append('model_id', ELEVENLABS_MODEL)
    
    // Add the audio file - field name MUST be 'file'
    formData.append('file', fileBuffer, {
      filename: basename(filePath),
      contentType: getContentType(basename(filePath)),
    })
    
    // For free tier: enable diarization (speaker identification)
    // Parameter name is 'diarize' (NOT 'diarization'!)
    if (!shouldUseAuth) {
      formData.append('diarize', 'true')
    }
    
    // Enable audio event tagging (laughter, applause, etc.)
    formData.append('tag_audio_events', 'true')
    
    logger.info(`[ElevenLabs] Using model: ${ELEVENLABS_MODEL}`)
    logger.info(`[ElevenLabs] Using ${shouldUseAuth ? 'authenticated' : 'FREE'} endpoint`)
    logger.info(`[ElevenLabs] Sending request to: ${apiUrl}`)
    
    // Parse URL for https.request
    const url = new URL(apiUrl)
    
    // Prepare options for https.request
    const options: any = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://elevenlabs.io',
        'Referer': 'https://elevenlabs.io/',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...formData.getHeaders(), // This includes the correct Content-Type with boundary
      },
    }

    // Add API key ONLY for authenticated endpoint
    if (shouldUseAuth && ELEVENLABS_API_KEY) {
      options.headers['xi-api-key'] = ELEVENLABS_API_KEY
      logger.info('[ElevenLabs] Using API key authentication')
    } else {
      logger.info('[ElevenLabs] Using FREE public endpoint (no API key)')
    }

    // Make request using https module which properly handles form-data streams
    const result = await new Promise<any>((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        let data = ''
        
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString()
        })
        
        res.on('end', () => {
          logger.info(`[ElevenLabs] Response status: ${res.statusCode} ${res.statusMessage}`)
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data))
            } catch (e) {
              reject({
                message: 'Failed to parse API response',
                code: 'PARSE_ERROR',
                details: data,
              })
            }
          } else {
            logger.error(`[ElevenLabs] API error response:`, data)
            reject({
              message: `ElevenLabs API error: ${res.statusMessage}`,
              statusCode: res.statusCode,
              code: 'API_ERROR',
              details: data,
            })
          }
        })
      })
      
      req.on('error', (error: Error) => {
        reject({
          message: `Request failed: ${error.message}`,
          code: 'REQUEST_ERROR',
        })
      })
      
      // Pipe the form data to the request
      formData.pipe(req)
    })

    // If we get here with an error status and should retry
    if (!result && shouldUseAuth && useAuth !== false) {
      logger.warn('[ElevenLabs] Authenticated endpoint failed, trying free endpoint...')
      return transcribeAudio(filePath, fileName, false)
    }

    logger.info(`[ElevenLabs] Transcription successful`)
    logger.info(`[ElevenLabs] Language: ${result.language_code} (${(result.language_probability * 100).toFixed(1)}% confidence)`)
    logger.info(`[ElevenLabs] Word count: ${result.words?.length || 0} words with timestamps`)

    // Extract text from response
    // ElevenLabs API returns: { text, language_code, language_probability, words, transcription_id, additional_formats }
    const text = result.text || result.transcript || ''
    
    if (!text) {
      logger.error('[ElevenLabs] No text in response', JSON.stringify(result, null, 2))
      throw {
        message: 'No transcription text returned from API',
        code: 'EMPTY_TRANSCRIPTION',
        details: result,
      }
    }

    // Count words (from text or from words array)
    const wordCount = result.words?.filter((w: any) => w.type === 'word').length || 
                      text.trim().split(/\s+/).filter(Boolean).length

    // Return structured result with all metadata
    return {
      text,
      language: result.language_code || result.language || 'en',
      durationSeconds: result.duration,
      wordCount,
      // Include ElevenLabs specific metadata
      languageCode: result.language_code,
      languageProbability: result.language_probability,
      transcriptionId: result.transcription_id,
      words: result.words,
      additionalFormats: result.additional_formats,
    }
  } catch (error: any) {
    logger.error('[ElevenLabs] Transcription error', error)
    
    // If authenticated endpoint failed and we can retry with free
    if (error.statusCode && shouldUseAuth && useAuth !== false) {
      logger.warn('[ElevenLabs] Authenticated endpoint failed, trying free endpoint...')
      return transcribeAudio(filePath, fileName, false)
    }
    
    // If this is already a structured error, rethrow it
    if (error.code) {
      throw error
    }
    
    // Wrap unknown errors
    if (error instanceof Error) {
      throw {
        message: error.message,
        code: 'TRANSCRIPTION_ERROR',
      }
    }
    
    throw {
      message: 'Unknown transcription error',
      code: 'UNKNOWN_ERROR',
    }
  }
}

/**
 * Determine content type based on file extension
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  
  const contentTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'mp4': 'audio/mp4',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'webm': 'audio/webm',
    'aac': 'audio/aac',
  }
  
  return contentTypes[ext || ''] || 'audio/mpeg'
}

/**
 * Check if ElevenLabs API is configured with authentication
 */
export function isConfigured(): boolean {
  return !!ELEVENLABS_API_KEY
}

/**
 * Check if free endpoint is available (always true)
 */
export function isFreeEndpointAvailable(): boolean {
  return true
}

/**
 * Get current endpoint configuration info
 */
export function getEndpointInfo(): { mode: 'authenticated' | 'free'; url: string } {
  if (ELEVENLABS_API_KEY) {
    return {
      mode: 'authenticated',
      url: ELEVENLABS_BASE_URL,
    }
  }
  return {
    mode: 'free',
    url: `${ELEVENLABS_BASE_URL}?allow_unauthenticated=1`,
  }
}

/**
 * Mock transcription for development/testing without API key
 * 
 * @param filePath - Path to the audio file
 * @param fileName - Original filename
 * @returns Mock transcription result
 */
export async function mockTranscription(
  _filePath: string,
  fileName: string
): Promise<TranscriptionResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  const mockText = `This is a mock transcription of the file "${fileName}". In a production environment, this would contain the actual transcribed text from the audio file. The transcription process typically involves converting speech to text using advanced AI models.`

  return {
    text: mockText,
    language: 'en',
    durationSeconds: 120,
    wordCount: mockText.split(/\s+/).length,
  }
}
