import { NextRequest, NextResponse } from 'next/server';
import { getServicesStatus } from '@/lib/api-keys/startup';

/**
 * GET /api/admin/api-keys/status
 * 
 * Get real-time status of background services
 */
export async function GET(_request: NextRequest) {
  try {
    const status = getServicesStatus();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: status,
    });
  } catch (error) {
    console.error('Error getting services status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get services status',
      },
      { status: 500 }
    );
  }
}
