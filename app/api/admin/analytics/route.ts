/**
 * Enhanced Analytics API Endpoint
 * GET - Comprehensive platform analytics with detailed metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface AnalyticsData {
  timestamp: string;
  users: {
    total: number;
    activeToday: number;
    activeWeek: number;
    activeMonth: number;
    newToday: number;
    newWeek: number;
    newMonth: number;
    retention: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    growth: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  content: {
    uploads: {
      total: number;
      today: number;
      week: number;
      month: number;
      byType: {
        audio: number;
        pdf: number;
        other: number;
      };
    };
    processing: {
      transcriptions: {
        total: number;
        successful: number;
        failed: number;
        avgDuration: number;
      };
      summaries: {
        total: number;
        successful: number;
        failed: number;
        avgLength: number;
      };
    };
  };
  storage: {
    total: number;
    audio: number;
    pdf: number;
    other: number;
    growth: number;
  };
  performance: {
    avgUploadTime: number;
    avgTranscriptionTime: number;
    avgSummaryTime: number;
    errorRates: {
      upload: number;
      transcription: number;
      summary: number;
    };
  };
  engagement: {
    avgSessionDuration: number;
    pagesPerSession: number;
    bounceRate: number;
    mostUsedFeatures: Array<{
      feature: string;
      usage: number;
      trend: number;
    }>;
  };
  revenue: {
    totalRevenue: number;
    monthlyRecurring: number;
    tierDistribution: Array<{
      tier: string;
      users: number;
      revenue: number;
    }>;
    churnRate: number;
  };
}

function verifyAdminAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  return apiKey === process.env.ADMIN_API_KEY;
}

async function getUserAnalytics(supabase: any) {
  try {
    // Get total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get users by time period
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      { count: activeToday },
      { count: activeWeek },
      { count: activeMonth },
      { count: newToday },
      { count: newWeek },
      { count: newMonth }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', today.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', weekAgo.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', monthAgo.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', monthAgo.toISOString())
    ]);

    // Calculate growth rates (mock calculation)
    const dailyGrowth = newToday || 0;
    const weeklyGrowth = ((newWeek || 0) / Math.max(totalUsers || 1, 1)) * 100;
    const monthlyGrowth = ((newMonth || 0) / Math.max(totalUsers || 1, 1)) * 100;

    return {
      total: totalUsers || 0,
      activeToday: activeToday || 0,
      activeWeek: activeWeek || 0,
      activeMonth: activeMonth || 0,
      newToday: newToday || 0,
      newWeek: newWeek || 0,
      newMonth: newMonth || 0,
      retention: {
        daily: Math.min(((activeToday || 0) / Math.max(totalUsers || 1, 1)) * 100, 100),
        weekly: Math.min(((activeWeek || 0) / Math.max(totalUsers || 1, 1)) * 100, 100),
        monthly: Math.min(((activeMonth || 0) / Math.max(totalUsers || 1, 1)) * 100, 100)
      },
      growth: {
        daily: dailyGrowth,
        weekly: Math.round(weeklyGrowth * 100) / 100,
        monthly: Math.round(monthlyGrowth * 100) / 100
      }
    };
  } catch (error) {
    console.error('User analytics error:', error);
    return {
      total: 0, activeToday: 0, activeWeek: 0, activeMonth: 0,
      newToday: 0, newWeek: 0, newMonth: 0,
      retention: { daily: 0, weekly: 0, monthly: 0 },
      growth: { daily: 0, weekly: 0, monthly: 0 }
    };
  }
}

async function getContentAnalytics(supabase: any) {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get upload statistics
    const [
      { count: totalUploads },
      { count: uploadsToday },
      { count: uploadsWeek },
      { count: uploadsMonth }
    ] = await Promise.all([
      supabase.from('uploads').select('*', { count: 'exact', head: true }),
      supabase.from('uploads').select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString()),
      supabase.from('uploads').select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString()),
      supabase.from('uploads').select('*', { count: 'exact', head: true })
        .gte('created_at', monthAgo.toISOString())
    ]);

    // No file-type distribution available without a type column; return zeros
    const audioCount = 0;
    const pdfCount = 0;
    const otherCount = 0;

    // Get processing statistics (totals only, do not fabricate success/failure)
    const [
      { count: totalTranscriptions },
      { count: totalSummaries }
    ] = await Promise.all([
      supabase.from('transcriptions').select('*', { count: 'exact', head: true }),
      supabase.from('summaries').select('*', { count: 'exact', head: true })
    ]);

    return {
      uploads: {
        total: totalUploads || 0,
        today: uploadsToday || 0,
        week: uploadsWeek || 0,
        month: uploadsMonth || 0,
        byType: {
          audio: audioCount,
          pdf: pdfCount,
          other: otherCount
        }
      },
      processing: {
        transcriptions: {
          total: totalTranscriptions || 0,
          successful: 0,
          failed: 0,
          avgDuration: 0
        },
        summaries: {
          total: totalSummaries || 0,
          successful: 0,
          failed: 0,
          avgLength: 0
        }
      }
    };
  } catch (error) {
    console.error('Content analytics error:', error);
    return {
      uploads: {
        total: 0, today: 0, week: 0, month: 0,
        byType: { audio: 0, pdf: 0, other: 0 }
      },
      processing: {
        transcriptions: { total: 0, successful: 0, failed: 0, avgDuration: 0 },
        summaries: { total: 0, successful: 0, failed: 0, avgLength: 0 }
      }
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [userAnalytics, contentAnalytics] = await Promise.all([
      getUserAnalytics(supabase),
      getContentAnalytics(supabase)
    ]);

    // Only return data derived from the database or zeroed when unavailable
    const analyticsData: AnalyticsData = {
      timestamp: new Date().toISOString(),
      users: userAnalytics,
      content: contentAnalytics,
      storage: {
        total: 0,
        audio: 0,
        pdf: 0,
        other: 0,
        growth: 0
      },
      performance: {
        avgUploadTime: 0,
        avgTranscriptionTime: 0,
        avgSummaryTime: 0,
        errorRates: {
          upload: 0,
          transcription: 0,
          summary: 0
        }
      },
      engagement: {
        avgSessionDuration: 0,
        pagesPerSession: 0,
        bounceRate: 0,
        mostUsedFeatures: []
      },
      revenue: {
        totalRevenue: 0,
        monthlyRecurring: 0,
        tierDistribution: [],
        churnRate: 0
      }
    };

    return NextResponse.json({
      success: true,
      data: analyticsData
    });
  } catch (error: any) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}