import { createClient } from '@/services/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get recent transcriptions
    const { data: transcriptions } = await supabase
      .from('transcriptions')
      .select('id, created_at, user_id, users(email)')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent summaries
    const { data: summaries } = await supabase
      .from('summaries')
      .select('id, title, created_at, user_id, users(email)')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent users
    const { data: newUsers } = await supabase
      .from('users')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Combine and format activities
    const activities: any[] = [];

    // Add transcriptions
    transcriptions?.forEach((t: any) => {
      activities.push({
        id: `trans-${t.id}`,
        type: 'transcription',
        user_email: t.users?.email,
        description: 'New transcription completed',
        created_at: t.created_at,
      });
    });

    // Add summaries
    summaries?.forEach((s: any) => {
      activities.push({
        id: `summ-${s.id}`,
        type: 'summary',
        user_email: s.users?.email,
        description: `Summary created: ${s.title || 'Untitled'}`,
        created_at: s.created_at,
      });
    });

    // Add new users
    newUsers?.forEach((u: any) => {
      activities.push({
        id: `user-${u.id}`,
        type: 'user_signup',
        user_email: u.email,
        description: 'New user signed up',
        created_at: u.created_at,
      });
    });

    // Sort by date and limit to 20 most recent
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentActivities = activities.slice(0, 20);

    return NextResponse.json({
      success: true,
      activities: recentActivities,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch activity',
        activities: [],
      },
      { status: 500 }
    );
  }
}
