/**
 * Global Session Manager
 *
 * Prevents duplicate session creation across multiple component renders
 * and manages session lifecycle globally.
 */

import { logger } from '@/lib/utils/logger'

interface SessionInfo {
  sessionId: string
  userId: string
  url: string
  createdAt: number
  isActive: boolean
}

class SessionManager {
  private sessions = new Map<string, SessionInfo>()
  private activeSessions = new Set<string>()

  /**
   * Check if a session already exists for the given user and URL
   */
  hasActiveSession(userId: string, url: string): boolean {
    for (const session of this.sessions.values()) {
      if (
        session.userId === userId &&
        session.url === url &&
        session.isActive
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Get existing session for user and URL
   */
  getExistingSession(userId: string, url: string): SessionInfo | null {
    for (const session of this.sessions.values()) {
      if (
        session.userId === userId &&
        session.url === url &&
        session.isActive
      ) {
        return session
      }
    }
    return null
  }

  /**
   * Register a new session
   */
  registerSession(sessionId: string, userId: string, url: string): void {
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      logger.warn('Session already exists, skipping registration', {
        sessionId
      })
      return
    }

    // Check if there's already an active session for this user/URL
    const existingSession = this.getExistingSession(userId, url)
    if (existingSession) {
      logger.warn(
        'Active session already exists for user/URL, skipping registration',
        {
          existingSessionId: existingSession.sessionId,
          newSessionId: sessionId,
          userId,
          url
        }
      )
      return
    }

    const sessionInfo: SessionInfo = {
      sessionId,
      userId,
      url,
      createdAt: Date.now(),
      isActive: true
    }

    this.sessions.set(sessionId, sessionInfo)
    this.activeSessions.add(sessionId)

    logger.info('Session registered successfully', {
      sessionId,
      userId,
      url,
      totalSessions: this.sessions.size
    })
  }

  /**
   * Unregister a session
   */
  unregisterSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.isActive = false
      this.activeSessions.delete(sessionId)

      logger.info('Session unregistered successfully', {
        sessionId,
        totalSessions: this.sessions.size
      })
    } else {
      logger.warn('Session not found for unregistration', { sessionId })
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): SessionInfo | null {
    return this.sessions.get(sessionId) || null
  }

  /**
   * Clean up old sessions (older than 1 hour)
   */
  cleanupOldSessions(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    let cleanedCount = 0

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.createdAt < oneHourAgo) {
        this.sessions.delete(sessionId)
        this.activeSessions.delete(sessionId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up old sessions', {
        cleanedCount,
        remainingSessions: this.sessions.size
      })
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).filter(
      session => session.isActive
    )
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    this.sessions.clear()
    this.activeSessions.clear()
    logger.info('All sessions cleared')
  }
}

// Export singleton instance
export const sessionManager = new SessionManager()

// Clean up old sessions every 30 minutes
setInterval(
  () => {
    sessionManager.cleanupOldSessions()
  },
  30 * 60 * 1000
)
