/**
 * URL validation and platform detection for video downloads
 */

import type { ValidationResult } from './types'

// Supported video platforms
const SUPPORTED_PLATFORMS = [
  { domain: 'youtube.com', name: 'YouTube' },
  { domain: 'youtu.be', name: 'YouTube' },
  { domain: 'vimeo.com', name: 'Vimeo' },
  { domain: 'dailymotion.com', name: 'Dailymotion' },
  { domain: 'twitch.tv', name: 'Twitch' },
  { domain: 'facebook.com', name: 'Facebook' },
  { domain: 'twitter.com', name: 'Twitter/X' },
  { domain: 'x.com', name: 'Twitter/X' },
  { domain: 'tiktok.com', name: 'TikTok' },
  { domain: 'instagram.com', name: 'Instagram' },
  { domain: 'reddit.com', name: 'Reddit' },
  { domain: 'soundcloud.com', name: 'SoundCloud' },
] as const

/**
 * Validate if a URL is supported for video download
 * 
 * NOTE: This validation is intentionally permissive. We accept any valid HTTP/HTTPS URL
 * because yt-dlp supports 1500+ video platforms. Rather than maintaining a whitelist,
 * we let yt-dlp attempt the download and handle failures gracefully.
 */
export function isValidVideoUrl(url: string): ValidationResult {
  try {
    // Parse URL
    const parsed = new URL(url)
    
    // Check protocol
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        error: 'Only HTTP and HTTPS URLs are supported'
      }
    }
    
    // Check if it's a known platform (for better user feedback)
    const platform = SUPPORTED_PLATFORMS.find(p => 
      parsed.hostname.includes(p.domain)
    )
    
    // Accept the URL regardless of whether we recognize the platform
    // yt-dlp supports 1500+ sites, so we let it try
    const result: ValidationResult = {
      isValid: true
    }
    if (platform) {
      result.platform = platform.name
    }
    return result
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid URL format. Please enter a valid video URL.'
    }
  }
}

/**
 * Get list of supported platforms
 */
export function getSupportedPlatforms(): string[] {
  return SUPPORTED_PLATFORMS.map(p => p.name)
}

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    const platform = SUPPORTED_PLATFORMS.find(p => 
      parsed.hostname.includes(p.domain)
    )
    return platform?.name
  } catch (_error) {
    return undefined
  }
}

