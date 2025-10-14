'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Server,
  Database,
  Activity,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Globe,
  HardDrive,
  Cpu,
  MemoryStick,
  RefreshCw,
  AlertCircle,
  Key
} from 'lucide-react';
import Link from 'next/link';
import AdminApiKeysDashboard from '@/app/admin/api-keys/page';

interface PlatformStats {
  users: {
    total: number;
    active_last_24h: number;
    active_last_7d: number;
    new_today: number;
  };
  files: {
    total_uploads: number;
    total_transcriptions: number;
    total_summaries: number;
    total_pdfs: number;
    uploads_today: number;
  };
  storage: {
    total_size_mb: number;
    audio_files_mb: number;
    pdf_files_mb: number;
  };
}

interface HealthMetrics {
  timestamp: string;
  services: {
    upload: { status: string; message: string; responseTime?: number };
    transcribe: { status: string; message: string; responseTime?: number };
    summarize: { status: string; message: string; responseTime?: number };
    pdf: { status: string; message: string; responseTime?: number };
  };
  database: {
    status: string;
    connectionTime?: number;
    activeConnections?: number;
    responseTime?: number;
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

interface ApiKey {
  id: string;
  api_key: string;
  source: string;
  status: 'pending' | 'valid' | 'quota_reached' | 'invalid';
  last_validated_at: string | null;
  success_count: number;
  error_count: number;
}

interface ApiKeyStats {
  total: number;
  valid: number;
  invalid: number;
  quota_reached: number;
  pending: number;
  series?: Array<{
    timestamp: string;
    valid: number;
    quota_exceeded: number;
  }>;
}

interface ServiceStatus {
  scraper: { running: boolean };
  processor: { running: boolean };
  validator: { running: boolean };
}

export default function AdminDashboard() {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyStats, setApiKeyStats] = useState<ApiKeyStats | null>(null);
  const [, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'health' | 'api-keys'>('overview');

  // No fabricated chart data; charts will render only if time-series data is provided later
  const [performanceHistory] = useState<any[]>([]);
  const [userGrowthData] = useState<any[]>([]);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  const fetchPlatformStats = async () => {
    try {
      // In a real implementation, you'd have an API endpoint for this
      // For now, we'll create mock data structure
      const response = await fetch('/api/admin/stats', { cache: 'no-store' }).catch(() => null);
      
      if (response && response.ok) {
        const data = await response.json();
        setPlatformStats(data.stats);
      } else {
        // Mock data if endpoint doesn't exist yet
        setPlatformStats({
          users: {
            total: 0,
            active_last_24h: 0,
            active_last_7d: 0,
            new_today: 0,
          },
          files: {
            total_uploads: 0,
            total_transcriptions: 0,
            total_summaries: 0,
            total_pdfs: 0,
            uploads_today: 0,
          },
          storage: {
            total_size_mb: 0,
            audio_files_mb: 0,
            pdf_files_mb: 0,
          },
        });
      }
    } catch (err) {
      console.error('Error fetching platform stats:', err);
    }
  };

  const fetchHealthMetrics = async () => {
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setHealthMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching health metrics:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const headers: Record<string, string> = {};
      const apiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY;
      if (apiKey) headers['x-api-key'] = apiKey;

      const response = await fetch('/api/admin/analytics', { 
        headers, 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data.data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const headers: Record<string, string> = {};
      const apiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY;
      if (apiKey) headers['x-api-key'] = apiKey;

      const [keysRes, statsRes, statusRes] = await Promise.all([
        fetch('/api/admin/dashboard/keys?limit=5', { headers, cache: 'no-store' }),
        fetch('/api/admin/api-keys/stats', { headers, cache: 'no-store' }),
        fetch('/api/admin/api-keys/status', { headers, cache: 'no-store' }),
      ]);

      if (keysRes.ok) {
        const keysData = await keysRes.json();
        setApiKeys(keysData.data || []);
      }

      if (statsRes.ok) {
        const s = await statsRes.json();
        const mapped = {
          total: s.totalScraped ?? 0,
          valid: s.totalValid ?? 0,
          invalid: Math.max((s.totalValidated ?? 0) - (s.totalValid ?? 0) - (s.totalQuotaExceeded ?? 0), 0),
          quota_reached: s.totalQuotaExceeded ?? 0,
          pending: s.pendingValidation ?? 0,
          series: s.series ?? []
        } as unknown as ApiKeyStats & { series: any[] };
        setApiKeyStats(mapped as any);
      }

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setServiceStatus(statusData?.services || null);
      }
    } catch (err) {
      console.error('Error fetching API keys:', err);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      await Promise.all([
        fetchPlatformStats(),
        fetchHealthMetrics(),
        fetchAnalytics(),
        fetchApiKeys(),
      ]);
      setLoading(false);
    };

    fetchAll();
    const interval = setInterval(fetchAll, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b sticky top-0 z-10 bg-background">
        <div className="container max-w-7xl mx-auto px-4 h-[70px] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-medium">
              FrogBytes
            </Link>
            <h1 className="text-base font-medium">Admin Dashboard</h1>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">My Dashboard</Link>
          </Button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b bg-accent/50">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('overview')}
            >
              <Activity className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button
              variant={activeTab === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('analytics')}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button
              variant={activeTab === 'health' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('health')}
            >
              <Server className="w-4 h-4 mr-2" />
              System Health
            </Button>
            <Button
              variant={activeTab === 'api-keys' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('api-keys')}
            >
              <Database className="w-4 h-4 mr-2" />
              API Keys
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Overview Tab - Enhanced */}
        {activeTab === 'overview' && (
          <>
            {/* Real-time System Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">System Status</p>
                      <p className="text-2xl font-bold text-green-500">Healthy</p>
                    </div>
                    <Server className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                      <p className="text-2xl font-bold">
                        {healthMetrics?.performance.avgResponseTime || 0}ms
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold text-green-500">
                        {healthMetrics?.performance.successRate || 0}%
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Requests/min</p>
                      <p className="text-2xl font-bold">
                        {healthMetrics?.performance.requestsPerMinute || 0}
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="border bg-background">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="responseTime" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Response Time (ms)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="requests" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                        name="Requests"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* System Resources */}
              <Card className="border bg-background">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Cpu className="w-5 h-5 mr-2" />
                    System Resources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {healthMetrics && (
                    <>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium flex items-center">
                            <MemoryStick className="w-4 h-4 mr-2" />
                            Memory Usage
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {healthMetrics.system.memory.percentage}%
                          </span>
                        </div>
                        <Progress value={healthMetrics.system.memory.percentage} className="h-3" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {healthMetrics.system.memory.used}MB / {healthMetrics.system.memory.total}MB
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium flex items-center">
                            <Clock className="w-4 h-4 mr-2" />
                            Uptime
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatDuration(healthMetrics.system.uptime)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium flex items-center">
                            <Database className="w-4 h-4 mr-2" />
                            Database
                          </span>
                          <span className="text-sm flex items-center">
                            {getStatusIcon(healthMetrics.database.status)}
                            <span className="ml-2">{healthMetrics.database.responseTime}ms</span>
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Platform Statistics - Enhanced */}
            {platformStats && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium">Platform Statistics</h2>
                
                {/* User Stats */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">Users</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.users.total}</div>
                        <div className="text-xs text-muted-foreground">Total Users</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium text-primary">{platformStats.users.active_last_24h}</div>
                        <div className="text-xs text-muted-foreground">Active 24h</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.users.active_last_7d}</div>
                        <div className="text-xs text-muted-foreground">Active 7d</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium text-primary">{platformStats.users.new_today}</div>
                        <div className="text-xs text-muted-foreground">New Today</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* File Stats */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">Content</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.files.total_uploads}</div>
                        <div className="text-xs text-muted-foreground">Total Uploads</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.files.total_transcriptions}</div>
                        <div className="text-xs text-muted-foreground">Transcriptions</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.files.total_summaries}</div>
                        <div className="text-xs text-muted-foreground">Summaries</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.files.total_pdfs}</div>
                        <div className="text-xs text-muted-foreground">PDFs</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium text-primary">{platformStats.files.uploads_today}</div>
                        <div className="text-xs text-muted-foreground">Today</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Storage Stats */}
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">Storage</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.storage.total_size_mb.toFixed(1)} MB</div>
                        <div className="text-xs text-muted-foreground">Total Storage</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.storage.audio_files_mb.toFixed(1)} MB</div>
                        <div className="text-xs text-muted-foreground">Audio Files</div>
                      </CardContent>
                    </Card>
                    <Card className="border bg-background">
                      <CardContent className="p-4">
                        <div className="text-2xl font-medium">{platformStats.storage.pdf_files_mb.toFixed(1)} MB</div>
                        <div className="text-xs text-muted-foreground">PDF Files</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Status Overview - Enhanced */}
            <div className="space-y-4 mt-8">
              <h2 className="text-lg font-medium">Service Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Services Health */}
                <Card className="border bg-background">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center">
                      <Globe className="w-5 h-5 mr-2" />
                      API Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {healthMetrics && Object.entries(healthMetrics.services).map(([key, service]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="capitalize flex items-center">
                          {getStatusIcon(service.status)}
                          <span className="ml-2">{key}</span>
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">
                            {service.responseTime}ms
                          </span>
                          <Badge variant={service.status === 'healthy' ? 'default' : 'destructive'} className="text-xs">
                            {service.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* API Keys Summary */}
                <Card className="border bg-background">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center">
                      <Database className="w-5 h-5 mr-2" />
                      API Keys Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {apiKeyStats && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span>Valid Keys</span>
                          <Badge variant="default" className="text-xs font-mono">
                            {apiKeyStats.valid}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Quota Reached</span>
                          <Badge variant="outline" className="text-xs font-mono">
                            {apiKeyStats.quota_reached}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Pending</span>
                          <Badge variant="outline" className="text-xs font-mono">
                            {apiKeyStats.pending}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Invalid</span>
                          <Badge variant="outline" className="text-xs font-mono text-destructive">
                            {apiKeyStats.invalid}
                          </Badge>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* Analytics Tab - NEW */}
        {activeTab === 'analytics' && analyticsData && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-500">
                        ${analyticsData.revenue.totalRevenue.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-bold">{analyticsData.users.activeMonth}</p>
                      <p className="text-xs text-green-500 flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        +{analyticsData.users.growth.monthly}% this month
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Content Processed</p>
                      <p className="text-2xl font-bold">{analyticsData.content.uploads.total}</p>
                      <p className="text-xs text-muted-foreground">
                        {analyticsData.content.uploads.week} this week
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
                      <p className="text-2xl font-bold">{analyticsData.storage.total.toFixed(1)} MB</p>
                      <p className="text-xs text-blue-500 flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        +{analyticsData.storage.growth}% growth
                      </p>
                    </div>
                    <HardDrive className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* User Growth Chart */}
              <Card className="border bg-background">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    User Growth Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* API Key Statistics Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Key className="w-5 h-5 mr-2" />
                    API Key Status Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={apiKeyStats?.series || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                      <YAxis />
                      <Tooltip labelFormatter={(t) => new Date(String(t)).toLocaleString()} />
                      <Legend />
                      <Line type="monotone" dataKey="valid" stroke="#16a34a" name="Valid" />
                      <Line type="monotone" dataKey="quota_exceeded" stroke="#eab308" name="Quota Exceeded" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Content Type Distribution */}
              <Card className="border bg-background">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Content Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Audio Files', value: analyticsData.content.uploads.byType.audio, fill: COLORS[0] },
                          { name: 'PDF Files', value: analyticsData.content.uploads.byType.pdf, fill: COLORS[1] },
                          { name: 'Other Files', value: analyticsData.content.uploads.byType.other, fill: COLORS[2] }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Audio Files', value: analyticsData.content.uploads.byType.audio },
                          { name: 'PDF Files', value: analyticsData.content.uploads.byType.pdf },
                          { name: 'Other Files', value: analyticsData.content.uploads.byType.other }
                        ].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Performance & Features */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Processing Performance */}
              <Card className="border bg-background">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Zap className="w-5 h-5 mr-2" />
                    Processing Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: 'Upload', time: analyticsData.performance.avgUploadTime, error: analyticsData.performance.errorRates.upload },
                      { name: 'Transcription', time: analyticsData.performance.avgTranscriptionTime, error: analyticsData.performance.errorRates.transcription },
                      { name: 'Summary', time: analyticsData.performance.avgSummaryTime, error: analyticsData.performance.errorRates.summary }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="time" fill="#8884d8" name="Avg Time (s)" />
                      <Bar dataKey="error" fill="#ff7c7c" name="Error Rate (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Most Used Features */}
              <Card className="border bg-background">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Feature Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analyticsData.engagement.mostUsedFeatures.map((feature) => (
                    <div key={feature.feature} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{feature.feature}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">{feature.usage}%</span>
                          <span className={`text-xs flex items-center ${feature.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {feature.trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                            {Math.abs(feature.trend)}%
                          </span>
                        </div>
                      </div>
                      <Progress value={feature.usage} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* User Engagement Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{Math.floor(analyticsData.engagement.avgSessionDuration / 60)}m {analyticsData.engagement.avgSessionDuration % 60}s</p>
                    <p className="text-sm text-muted-foreground">Avg Session Duration</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{analyticsData.engagement.pagesPerSession}</p>
                    <p className="text-sm text-muted-foreground">Pages per Session</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{analyticsData.engagement.bounceRate}%</p>
                    <p className="text-sm text-muted-foreground">Bounce Rate</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown */}
            <Card className="border bg-background">
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Revenue by Tier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.revenue.tierDistribution.map((tier) => (
                    <div key={tier.tier} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{tier.tier} Tier</p>
                        <p className="text-sm text-muted-foreground">{Math.floor(tier.users)} users</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">${tier.revenue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Enhanced Health Tab */}
        {activeTab === 'health' && (
          <>
            {/* System Health Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Overall Status</p>
                      <p className="text-2xl font-bold text-green-500">Healthy</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">System Uptime</p>
                      <p className="text-2xl font-bold">
                        {healthMetrics ? formatDuration(healthMetrics.system.uptime) : '0s'}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
                      <p className="text-2xl font-bold">
                        {healthMetrics ? `${healthMetrics.system.memory.percentage}%` : '0%'}
                      </p>
                    </div>
                    <MemoryStick className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border bg-background">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">DB Response</p>
                      <p className="text-2xl font-bold">
                        {healthMetrics ? `${healthMetrics.database.responseTime}ms` : '0ms'}
                      </p>
                    </div>
                    <Database className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Service Health */}
            <div className="space-y-4 mb-8">
              <h2 className="text-lg font-medium flex items-center">
                <Server className="w-5 h-5 mr-2" />
                Service Health Details
              </h2>
              
              {healthMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(healthMetrics.services).map(([key, service]) => (
                    <Card key={key} className="border bg-background">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-medium capitalize flex items-center">
                            {getStatusIcon(service.status)}
                            <span className="ml-2">{key} API</span>
                          </CardTitle>
                          <Badge 
                            variant={service.status === 'healthy' ? 'default' : 'destructive'} 
                            className="text-xs"
                          >
                            {service.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Response Time:</span>
                            <span className="font-medium">{service.responseTime}ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className={service.status === 'healthy' ? 'text-green-500' : 'text-red-500'}>
                              {service.message}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* System Resources Detail */}
            {healthMetrics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card className="border bg-background">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center">
                      <Cpu className="w-5 h-5 mr-2" />
                      System Resources
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Memory Usage</span>
                        <span className="text-sm text-muted-foreground">
                          {healthMetrics.system.memory.used}MB / {healthMetrics.system.memory.total}MB
                        </span>
                      </div>
                      <Progress value={healthMetrics.system.memory.percentage} className="h-3" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Environment:</span>
                        <Badge variant="outline">{healthMetrics.system.environment}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Version:</span>
                        <span className="text-sm font-mono">{healthMetrics.system.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Uptime:</span>
                        <span className="text-sm">{formatDuration(healthMetrics.system.uptime)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border bg-background">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center">
                      <Database className="w-5 h-5 mr-2" />
                      Database Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(healthMetrics.database.status)}
                      <span className="text-lg font-medium capitalize">
                        {healthMetrics.database.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Connection Time:</span>
                        <span className="text-sm">{healthMetrics.database.connectionTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Query Response:</span>
                        <span className="text-sm">{healthMetrics.database.responseTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Active Connections:</span>
                        <span className="text-sm">{healthMetrics.database.activeConnections}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* External Services Status */}
            {healthMetrics && (
              <Card className="border bg-background">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center">
                    <Globe className="w-5 h-5 mr-2" />
                    External Services
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(healthMetrics.externalServices).map(([service, status]) => (
                      <div key={service} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(status.status)}
                          <span className="font-medium capitalize">{service}</span>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={status.status === 'healthy' ? 'default' : 'destructive'} 
                            className="text-xs"
                          >
                            {status.status}
                          </Badge>
                          {status.responseTime !== undefined && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {status.responseTime}ms
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* API Keys Tab */}
        {activeTab === 'api-keys' && (
          <div className="pt-0">
            <AdminApiKeysDashboard />
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="text-center text-xs text-muted-foreground flex items-center justify-center space-x-2">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Auto-refreshing every 30 seconds • Last updated: {formatDistanceToNow(new Date(), { addSuffix: true })}</span>
        </div>
      </div>
    </main>
  );
}
