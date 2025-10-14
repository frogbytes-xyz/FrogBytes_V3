/**
 * Admin Dashboard API: System Status
 * GET - Get current status of scraper and validator
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSystemStatus, getExecutionHistory } from '@/lib/api-keys/logger-service';
import { getPoolStats } from '@/lib/api-keys/key-pool-service';
import { getTokenStatistics } from '@/lib/api-keys/github-token-manager';

function verifyAdminAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  return apiKey === process.env.ADMIN_API_KEY;
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [systemStatus, keyPoolStats, tokenStats, executionHistory] = await Promise.all([
      getSystemStatus(),
      getPoolStats(),
      getTokenStatistics(),
      getExecutionHistory(undefined, 10)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        services: systemStatus,
        keyPool: keyPoolStats,
        githubTokens: tokenStats,
        recentExecutions: executionHistory
      }
    });
  } catch (error: any) {
    console.error('Dashboard status API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
