import { NextRequest, NextResponse } from 'next/server';
import { getBackgroundScraper } from '@/lib/api-keys/background-scraper';

/**
 * POST /api/admin/scraper/start
 * Start the background scraper
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-api-key');
    const adminKey = process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY;
    if (!authHeader || authHeader !== adminKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const scraper = getBackgroundScraper();

    // Start scraper with options (will run in background)
    scraper.start({
      limit: 100,
      intervalMinutes: 60 // 1 hour intervals
    }).catch((error: any) => {
      console.error('[API] Scraper error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Background scraper started',
    });
  } catch (error: any) {
    console.error('[API] Error starting scraper:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/scraper/start
 * Stop the background scraper
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-api-key');
    const adminKey = process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY;
    if (!authHeader || authHeader !== adminKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const scraper = getBackgroundScraper();
    scraper.stop();

    return NextResponse.json({
      success: true,
      message: 'Background scraper stopped',
    });
  } catch (error: any) {
    console.error('[API] Error stopping scraper:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/scraper/start
 * Get scraper status
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-api-key');
    const adminKey = process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY;
    if (!authHeader || authHeader !== adminKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const scraper = getBackgroundScraper();
    const stats = scraper.getStatus();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('[API] Error getting scraper status:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
