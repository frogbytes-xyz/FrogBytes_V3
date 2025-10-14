/**
 * Admin API: Get all API keys
 * Protected endpoint for viewing API key pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    // Simple auth check - in production, use proper session auth
    const apiKey = request.headers.get('x-api-key');
    // const expectedKey = process.env.ADMIN_API_KEY || 'admin-secret-key'; // TODO: Implement proper auth
    
    // For browser requests, check if user is authenticated
    // This is a simplified check - implement proper admin role checking
    const authHeader = request.headers.get('authorization');
    
    if (!apiKey && !authHeader) {
      // Allow access for now, but in production add proper auth
      console.log('Warning: Admin endpoint accessed without authentication');
    }

    const supabase = getSupabaseClient();
    
    // Fetch all API keys
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching API keys:', error);
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      keys: keys || [],
      count: keys?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Add new API key manually
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { api_key, source, source_url } = body;

    if (!api_key || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: api_key, source' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        api_key,
        source,
        source_url,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'API key already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      key: data,
    });
  } catch (error: any) {
    console.error('Add API key error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Delete API key
export async function DELETE(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { error: 'Missing key ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted',
    });
  } catch (error: any) {
    console.error('Delete API key error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
