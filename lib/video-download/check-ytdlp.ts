/**
 * Utility to check if yt-dlp is installed and accessible
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface YtDlpCheck {
  isInstalled: boolean
  version?: string
  error?: string
}

/**
 * Check if yt-dlp is installed on the system
 */
export async function checkYtDlp(): Promise<YtDlpCheck> {
  try {
    const { stdout, stderr } = await execAsync('yt-dlp --version')

    if (stderr && !stdout) {
      return {
        isInstalled: false,
        error: stderr.trim()
      }
    }

    return {
      isInstalled: true,
      version: stdout.trim()
    }
  } catch (error) {
    return {
      isInstalled: false,
      error:
        error instanceof Error
          ? error.message
          : 'yt-dlp not found in system PATH'
    }
  }
}

/**
 * Verify yt-dlp is functional by testing with a known URL
 */
export async function verifyYtDlpFunctional(): Promise<boolean> {
  try {
    // Test with --simulate flag (doesn't download, just checks)
    await execAsync(
      'yt-dlp --simulate --no-warnings "https://www.youtube.com/watch?v=jNQXAC9IVRw"'
    )
    return true
  } catch {
    return false
  }
}
