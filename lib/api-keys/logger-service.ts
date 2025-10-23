import { logger } from '@/lib/utils/logger'

/**
 * Database Logger Service for Scraper/Validator
 * Logs all operations to database for admin dashboard
 */

import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success'
export type LogType = 'scraper' | 'validator'

export interface LogDetails {
  [key: string]: any
}

export class ApiKeyLogger {
  private executionId: string
  private logType: LogType
  private githubTokenId: string | null

  constructor(logType: LogType, executionId?: string, githubTokenId?: string) {
    this.logType = logType
    this.executionId = executionId || crypto.randomUUID()
    this.githubTokenId = githubTokenId ?? null
  }

  getExecutionId(): string {
    return this.executionId
  }

  /**
   * Log an event to the database
   */
  async log(
    level: LogLevel,
    message: string,
    details?: LogDetails,
    apiKey?: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient()

      await supabase.rpc('log_api_key_event', {
        p_log_type: this.logType,
        p_level: level,
        p_message: message,
        p_details: details || {},
        p_api_key: apiKey || null,
        p_github_token_id: this.githubTokenId || null,
        p_execution_id: this.executionId
      })

      // Also log to console for immediate visibility
      const prefix = `[${this.logType.toUpperCase()}][${this.executionId.substring(0, 8)}]`
      const consoleMessage = `${prefix} ${message}`

      switch (level) {
        case 'error':
          logger.error(consoleMessage, details)
          break
        case 'warn':
          logger.warn(consoleMessage, details)
          break
        case 'success':
          logger.info(`[SUCCESS] ${consoleMessage}`, details)
          break
        default:
          logger.info(consoleMessage, details)
      }
    } catch (error) {
      logger.error('Failed to log to database', error)
    }
  }

  async info(message: string, details?: LogDetails, apiKey?: string) {
    await this.log('info', message, details, apiKey)
  }

  async warn(message: string, details?: LogDetails, apiKey?: string) {
    await this.log('warn', message, details, apiKey)
  }

  async error(message: string, details?: LogDetails, apiKey?: string) {
    await this.log('error', message, details, apiKey)
  }

  async success(message: string, details?: LogDetails, apiKey?: string) {
    await this.log('success', message, details, apiKey)
  }
}

/**
 * Update system status in database
 */
export async function updateSystemStatus(
  serviceName: 'scraper' | 'validator' | 'revalidator',
  status: 'idle' | 'running' | 'completed' | 'failed',
  executionId: string,
  stats?: Record<string, any>,
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient()

    await supabase.rpc('update_system_status', {
      p_service_name: serviceName,
      p_status: status,
      p_execution_id: executionId,
      p_stats: stats || {},
      p_error_message: errorMessage || null
    })
  } catch (error) {
    logger.error('Failed to update system status', error)
  }
}

/**
 * Get recent logs from database
 */
export async function getRecentLogs(
  logType?: LogType,
  limit: number = 100
): Promise<any[]> {
  try {
    const supabase = getSupabaseClient()

    let query = supabase
      .from('api_key_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (logType) {
      query = query.eq('log_type', logType)
    }

    const { data, error } = await query

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Failed to get recent logs', error)
    return []
  }
}

/**
 * Get logs for a specific execution
 */
export async function getExecutionLogs(executionId: string): Promise<any[]> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('api_key_logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Failed to get execution logs', error)
    return []
  }
}

/**
 * Get system status
 */
export async function getSystemStatus(): Promise<{
  scraper: any
  validator: any
  revalidator: any
}> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('latest_system_status')
      .select('*')

    if (error) throw error

    const scraper = data?.find(s => s.service_name === 'scraper') || null
    const validator = data?.find(s => s.service_name === 'validator') || null
    const revalidator =
      data?.find(s => s.service_name === 'revalidator') || null

    return { scraper, validator, revalidator }
  } catch (error) {
    logger.error('Failed to get system status', error)
    return { scraper: null, validator: null, revalidator: null }
  }
}

/**
 * Get recent execution history
 */
export async function getExecutionHistory(
  serviceName?: 'scraper' | 'validator' | 'revalidator',
  limit: number = 20
): Promise<any[]> {
  try {
    const supabase = getSupabaseClient()

    let query = supabase
      .from('system_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (serviceName) {
      query = query.eq('service_name', serviceName)
    }

    const { data, error } = await query

    if (error) throw error

    return data || []
  } catch (error) {
    logger.error('Failed to get execution history', error)
    return []
  }
}
