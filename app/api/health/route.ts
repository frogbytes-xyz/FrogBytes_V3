/**
 * Enhanced Health API Endpoint
 * GET - Comprehensive system health check with performance metrics
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface HealthMetrics {
  timestamp: string;
  services: {
    upload: { status: string; message: string; responseTime?: number; uptime?: number };
    transcribe: { status: string; message: string; responseTime?: number; uptime?: number };
    summarize: { status: string; message: string; responseTime?: number; uptime?: number };
    pdf: { status: string; message: string; responseTime?: number; uptime?: number };
  };
  database: {
    status: string;
    connectionTime?: number | undefined;
    activeConnections?: number | undefined;
    responseTime?: number | undefined;
  };
  system: {
    memory: {
      used: number;
      total: number;
      free: number;
      percentage: number;
    };
    uptime: number;
    environment: string;
    version: string;
  };
  performance: {
    avgResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
    successRate: number;
  };
  externalServices: {
    gemini: { status: string; responseTime?: number };
    supabase: { status: string; responseTime?: number };
  };
}

// Simulate system metrics (in production, use actual system monitoring)
function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal + memoryUsage.external + memoryUsage.arrayBuffers;
  const usedMemory = memoryUsage.heapUsed;
  
  return {
    memory: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      free: Math.round((totalMemory - usedMemory) / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100)
    },
    uptime: Math.round(process.uptime()), // seconds
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };
}

async function testDatabaseConnection(): Promise<{status: string; connectionTime: number; responseTime?: number}> {
  const startTime = Date.now();
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseKey) {
      return { status: 'error', connectionTime: Date.now() - startTime };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const queryStart = Date.now();
    
    // Simple query to test connection
    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - queryStart;
    const connectionTime = Date.now() - startTime;
    
    if (error) {
      return { status: 'error', connectionTime, responseTime };
    }
    
    return { 
      status: 'healthy', 
      connectionTime,
      responseTime
    };
  } catch (error) {
    return { 
      status: 'error', 
      connectionTime: Date.now() - startTime 
    };
  }
}

async function testApiEndpoint(endpoint: string, method: 'GET' | 'POST' = 'GET'): Promise<{status: string; responseTime: number; message: string}> {
  const startTime = Date.now();
  
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    let response;
    if (method === 'POST' && endpoint === '/api/upload') {
      // For upload, just check if endpoint exists
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
    } else {
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
    }
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok || response.status === 405) { // 405 is fine for HEAD requests
      return {
        status: 'healthy',
        responseTime,
        message: `${method} ${endpoint} - OK (${response.status})`
      };
    } else {
      return {
        status: 'degraded',
        responseTime,
        message: `${method} ${endpoint} - ${response.status} ${response.statusText}`
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'error',
      responseTime,
      message: `${method} ${endpoint} - ${error.message || 'Connection failed'}`
    };
  }
}

async function testExternalService(serviceName: 'gemini' | 'supabase'): Promise<{status: string; responseTime?: number}> {
  const startTime = Date.now();
  
  try {
    if (serviceName === 'supabase') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        return { status: 'error' };
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: response.ok ? 'healthy' : 'degraded',
        responseTime
      };
    }
    
    if (serviceName === 'gemini') {
      // For Gemini, we check if API key is configured
      const hasApiKey = !!process.env.GOOGLE_API_KEY;
      return {
        status: hasApiKey ? 'healthy' : 'warning',
        responseTime: 0
      };
    }
    
    return { status: 'unknown' };
  } catch (error) {
    return { 
      status: 'error', 
      responseTime: Date.now() - startTime 
    };
  }
}

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Test all services concurrently
    const [
      uploadHealth,
      transcribeHealth,
      summarizeHealth,
      pdfHealth,
      dbHealth,
      geminiHealth,
      supabaseHealth
    ] = await Promise.all([
      testApiEndpoint('/api/upload', 'POST'),
      testApiEndpoint('/api/transcribe', 'POST'), 
      testApiEndpoint('/api/summarize', 'POST'),
      testApiEndpoint('/api/pdf', 'POST'),
      testDatabaseConnection(),
      testExternalService('gemini'),
      testExternalService('supabase')
    ]);

    const systemMetrics = getSystemMetrics();
    
    // Calculate performance metrics (mock data for demo)
    const totalResponseTime = uploadHealth.responseTime + transcribeHealth.responseTime + 
                             summarizeHealth.responseTime + pdfHealth.responseTime;
    const avgResponseTime = totalResponseTime / 4;
    
    const healthyServices = [uploadHealth, transcribeHealth, summarizeHealth, pdfHealth]
      .filter(s => s.status === 'healthy').length;
    const successRate = (healthyServices / 4) * 100;
    const errorRate = 100 - successRate;

    const healthData: HealthMetrics = {
      timestamp: new Date().toISOString(),
      services: {
        upload: uploadHealth,
        transcribe: transcribeHealth,
        summarize: summarizeHealth,
        pdf: pdfHealth
      },
      database: {
        status: dbHealth.status,
        connectionTime: dbHealth.connectionTime,
        responseTime: dbHealth.responseTime ?? undefined,
        activeConnections: Math.floor(Math.random() * 10) + 1 // Mock data
      },
      system: systemMetrics,
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        requestsPerMinute: Math.floor(Math.random() * 100) + 50, // Mock data
        errorRate: Math.round(errorRate * 100) / 100,
        successRate: Math.round(successRate * 100) / 100
      },
      externalServices: {
        gemini: geminiHealth,
        supabase: supabaseHealth
      }
    };

    const totalTime = Date.now() - startTime;
    
    return NextResponse.json(healthData, {
      headers: {
        'X-Response-Time': `${totalTime}ms`
      }
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        error: 'Health check failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}