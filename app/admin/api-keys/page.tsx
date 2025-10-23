'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/utils/logger'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  RefreshCw,
  Play,
  Pause,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Key,
  Activity,
  Database,
  ExternalLink
} from 'lucide-react'

const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''

export default function AdminApiKeysDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [status, setStatus] = useState<any>(null)
  const [keys, setKeys] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [githubTokens, setGithubTokens] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [revalidatorConcurrency, setRevalidatorConcurrency] =
    useState<number>(5)
  const [workingStatusFilter, setWorkingStatusFilter] = useState<
    'all' | 'valid' | 'quota_exceeded'
  >('all')
  const [minQuotaFilter, setMinQuotaFilter] = useState<
    'all' | '1' | '5' | '10'
  >('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Filters
  const [keyFilter, setKeyFilter] = useState({
    status: 'all',
    source: 'all',
    isValid: 'all'
  })
  const [logFilter, setLogFilter] = useState({ type: 'all', level: 'all' })

  // Dialogs
  const [showAddTokenDialog, setShowAddTokenDialog] = useState(false)
  const [newToken, setNewToken] = useState({ name: '', value: '' })
  const [showTokenValue, setShowTokenValue] = useState<Record<string, boolean>>(
    {}
  )

  const fetchStatus = async () => {
    const response = await fetch('/api/admin/dashboard/status', {
      headers: { 'x-api-key': ADMIN_API_KEY }
    })
    const data = await response.json()
    if (data.success) {
      setStatus(data.data)
    }
  }

  const fetchGithubTokens = async () => {
    const response = await fetch('/api/admin/dashboard/github-tokens', {
      headers: { 'x-api-key': ADMIN_API_KEY }
    })
    const data = await response.json()
    if (data.success) {
      setGithubTokens(data.data)
    }
  }

  const fetchKeys = useCallback(async () => {
    // If working filters are present, use working-keys endpoint
    if (workingStatusFilter !== 'all' || minQuotaFilter !== 'all') {
      const qp = new URLSearchParams()
      if (workingStatusFilter !== 'all')
        qp.append('status', workingStatusFilter)
      if (minQuotaFilter !== 'all') qp.append('minQuotaCount', minQuotaFilter)
      const r = await fetch(`/api/admin/dashboard/working-keys?${qp}`, {
        headers: { 'x-api-key': ADMIN_API_KEY }
      })
      const jd = await r.json()
      if (jd.success) {
        setKeys(jd.data)
        return
      }
    }

    const params = new URLSearchParams()
    if (keyFilter.status !== 'all') params.append('status', keyFilter.status)
    if (keyFilter.source !== 'all') params.append('source', keyFilter.source)
    if (keyFilter.isValid !== 'all') params.append('isValid', keyFilter.isValid)

    const response = await fetch(`/api/admin/dashboard/keys?${params}`, {
      headers: { 'x-api-key': ADMIN_API_KEY }
    })
    const data = await response.json()
    if (data.success) {
      setKeys(data.data)
    }
  }, [workingStatusFilter, minQuotaFilter, keyFilter])

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' })
    if (logFilter.type !== 'all') params.append('logType', logFilter.type)

    const response = await fetch(`/api/admin/dashboard/logs?${params}`, {
      headers: { 'x-api-key': ADMIN_API_KEY }
    })
    const data = await response.json()
    if (data.success) {
      setLogs(data.data)
    }
  }, [logFilter])

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchStatus(),
        fetchKeys(),
        fetchLogs(),
        fetchGithubTokens()
      ])
    } catch (error) {
      logger.error('Error fetching data', error)
    } finally {
      setLoading(false)
    }
  }, [fetchKeys, fetchLogs])

  const controlService = async (
    service: string,
    action: string,
    opts?: { limit?: number; concurrency?: number }
  ) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/dashboard/control', {
        method: 'POST',
        headers: {
          'x-api-key': ADMIN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service,
          action,
          limit: opts?.limit ?? 50,
          concurrency: opts?.concurrency
        })
      })
      const data = await response.json()
      if (data.success) {
        alert(`${service} ${action}ed successfully`)
        await fetchData()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      logger.error('Control service error', error)
      alert('Failed to control service')
    } finally {
      setLoading(false)
    }
  }

  const addGithubToken = async () => {
    if (!newToken.name || !newToken.value) {
      alert('Please provide both name and token value')
      return
    }

    try {
      const response = await fetch('/api/admin/dashboard/github-tokens', {
        method: 'POST',
        headers: {
          'x-api-key': ADMIN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token_name: newToken.name,
          token_value: newToken.value
        })
      })
      const data = await response.json()
      if (data.success) {
        alert('Token added successfully')
        setShowAddTokenDialog(false)
        setNewToken({ name: '', value: '' })
        await fetchGithubTokens()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      logger.error('Add token error', error)
      alert('Failed to add token')
    }
  }

  const toggleTokenActive = async (tokenId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/admin/dashboard/github-tokens', {
        method: 'PUT',
        headers: {
          'x-api-key': ADMIN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token_id: tokenId,
          is_active: !isActive
        })
      })
      const data = await response.json()
      if (data.success) {
        await fetchGithubTokens()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      logger.error('Toggle token error', error)
    }
  }

  const deleteGithubToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to delete this token?')) return

    try {
      const response = await fetch(
        `/api/admin/dashboard/github-tokens?token_id=${tokenId}`,
        {
          method: 'DELETE',
          headers: { 'x-api-key': ADMIN_API_KEY }
        }
      )
      const data = await response.json()
      if (data.success) {
        alert('Token deleted successfully')
        await fetchGithubTokens()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      logger.error('Delete token error', error)
    }
  }

  const initializeTokensFromEnv = async () => {
    try {
      const response = await fetch('/api/admin/dashboard/github-tokens', {
        method: 'POST',
        headers: {
          'x-api-key': ADMIN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'initialize' })
      })
      const data = await response.json()
      if (data.success) {
        alert('Tokens initialized from environment variables')
        await fetchGithubTokens()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      logger.error('Initialize tokens error', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
    return // Explicitly return undefined when autoRefresh is false
  }, [autoRefresh, fetchData])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      running: { color: 'bg-blue-500', icon: Activity },
      completed: { color: 'bg-green-500', icon: CheckCircle },
      failed: { color: 'bg-red-500', icon: XCircle },
      idle: { color: 'bg-gray-500', icon: Clock }
    }
    const config = variants[status] || variants.idle
    const Icon = config.icon
    return (
      <Badge className={`${config.color} text-white gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    )
  }

  const getLogLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      error: 'bg-red-500 text-white',
      warn: 'bg-yellow-500 text-white',
      success: 'bg-green-500 text-white',
      info: 'bg-blue-500 text-white'
    }
    return <Badge className={colors[level]}>{level}</Badge>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">API Key Management Dashboard</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`}
            />
            Auto Refresh: {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valid Keys</p>
                <p className="text-2xl font-bold">
                  {status.keyPool?.validKeys || 0}
                </p>
              </div>
              <Key className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Pending Validation
                </p>
                <p className="text-2xl font-bold">
                  {status.keyPool?.pendingValidation || 0}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">GitHub Tokens</p>
                <p className="text-2xl font-bold">
                  {status.githubTokens?.active || 0}/
                  {status.githubTokens?.total || 0}
                </p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scraped</p>
                <p className="text-2xl font-bold">
                  {status.keyPool?.totalScraped || 0}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="keys">Scraped Keys</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="github-tokens">GitHub Tokens</TabsTrigger>
          <TabsTrigger value="control">Service Control</TabsTrigger>
          <TabsTrigger value="revalidator">Revalidator</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Scraper Status</h3>
              {status?.services?.scraper ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Status:</span>
                    {getStatusBadge(status.services.scraper.status)}
                  </div>
                  {status.services.scraper.started_at && (
                    <div className="flex justify-between">
                      <span>Last Run:</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(
                          status.services.scraper.started_at
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {status.services.scraper.duration_ms && (
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="text-sm">
                        {status.services.scraper.duration_ms}ms
                      </span>
                    </div>
                  )}
                  {status.services.scraper.stats &&
                    Object.keys(status.services.scraper.stats).length > 0 && (
                      <div className="text-sm">
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(
                            status.services.scraper.stats,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-muted-foreground">No status available</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Validator Status</h3>
              {status?.services?.validator ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Status:</span>
                    {getStatusBadge(status.services.validator.status)}
                  </div>
                  {status.services.validator.started_at && (
                    <div className="flex justify-between">
                      <span>Last Run:</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(
                          status.services.validator.started_at
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {status.services.validator.duration_ms && (
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="text-sm">
                        {status.services.validator.duration_ms}ms
                      </span>
                    </div>
                  )}
                  {status.services.validator.stats &&
                    Object.keys(status.services.validator.stats).length > 0 && (
                      <div className="text-sm">
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(
                            status.services.validator.stats,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-muted-foreground">No status available</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Revalidator Status</h3>
              {status?.services?.revalidator ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Status:</span>
                    {getStatusBadge(status.services.revalidator.status)}
                  </div>
                  {status.services.revalidator.started_at && (
                    <div className="flex justify-between">
                      <span>Last Run:</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(
                          status.services.revalidator.started_at
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {status.services.revalidator.duration_ms && (
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="text-sm">
                        {status.services.revalidator.duration_ms}ms
                      </span>
                    </div>
                  )}
                  {status.services.revalidator.stats &&
                    Object.keys(status.services.revalidator.stats).length >
                      0 && (
                      <div className="text-sm">
                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(
                            status.services.revalidator.stats,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-muted-foreground">No status available</p>
              )}
            </Card>
          </div>

          {/* Recent Executions */}
          {status?.recentExecutions && status.recentExecutions.length > 0 && (
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Recent Executions</h3>
              <div className="space-y-2">
                {status.recentExecutions.slice(0, 5).map((exec: any) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="flex items-center gap-3">
                      <Badge>{exec.service_name}</Badge>
                      {getStatusBadge(exec.status)}
                      <span className="text-sm text-muted-foreground">
                        {new Date(exec.started_at).toLocaleString()}
                      </span>
                    </div>
                    {exec.duration_ms && (
                      <span className="text-sm">{exec.duration_ms}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={keyFilter.status}
              onValueChange={v => setKeyFilter({ ...keyFilter, status: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="validating">Validating</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={keyFilter.source}
              onValueChange={v => setKeyFilter({ ...keyFilter, source: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="gist">Gist</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={keyFilter.isValid}
              onValueChange={v => setKeyFilter({ ...keyFilter, isValid: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Validity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Valid</SelectItem>
                <SelectItem value="false">Invalid</SelectItem>
              </SelectContent>
            </Select>
            {/* Working Keys Filters */}
            <Select
              value={workingStatusFilter}
              onValueChange={v => setWorkingStatusFilter(v as any)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Working Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Working Status</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="quota_exceeded">Quota Exceeded</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={minQuotaFilter}
              onValueChange={v => setMinQuotaFilter(v as any)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Quota Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quotas</SelectItem>
                <SelectItem value="1">Quota ≥ 1</SelectItem>
                <SelectItem value="5">Quota ≥ 5</SelectItem>
                <SelectItem value="10">Quota ≥ 10</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>API Key</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Last Revalidated</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead>History</TableHead>
                  <TableHead>Scraped At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map(key => (
                  <TableRow key={key.id}>
                    <TableCell className="font-mono text-sm">
                      {key.api_key?.substring(0, 16)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{key.source}</Badge>
                        {key.source_url && (
                          <a
                            href={key.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="View on GitHub"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          key.validation_status === 'processed'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-500 text-white'
                        }
                      >
                        {key.validation_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.is_valid !== null ? (
                        key.is_valid ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      {key.working_status ? (
                        <Badge
                          className={
                            key.working_status === 'valid'
                              ? 'bg-green-500 text-white'
                              : 'bg-yellow-500 text-white'
                          }
                        >
                          {key.working_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.last_validated_at
                        ? new Date(key.last_validated_at).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {key.total_models_accessible}/{key.total_models_tested}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(key.history || [])
                          .slice(0, 3)
                          .map((h: any, idx: number) => (
                            <Badge
                              key={idx}
                              className={
                                h.outcome === 'valid'
                                  ? 'bg-green-500 text-white'
                                  : h.outcome === 'quota_exceeded'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-gray-400 text-white'
                              }
                              title={`${h.outcome} • ${new Date(h.at).toLocaleString()}`}
                            >
                              {h.outcome}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(key.scraped_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={logFilter.type}
              onValueChange={v => setLogFilter({ ...logFilter, type: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Log Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="scraper">Scraper</SelectItem>
                <SelectItem value="validator">Validator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="p-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="p-2 border rounded text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {getLogLevelBadge(log.level)}
                      <Badge variant="outline">{log.log_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* GitHub Tokens Tab */}
        <TabsContent value="github-tokens" className="space-y-4">
          <div className="flex gap-2">
            <Dialog
              open={showAddTokenDialog}
              onOpenChange={setShowAddTokenDialog}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Token
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add GitHub Token</DialogTitle>
                  <DialogDescription>
                    Add a new GitHub personal access token for scraping
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="token-name">Token Name</Label>
                    <Input
                      id="token-name"
                      placeholder="e.g., GITHUB_TOKEN_6"
                      value={newToken.name}
                      onChange={e =>
                        setNewToken({ ...newToken, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="token-value">Token Value</Label>
                    <Input
                      id="token-value"
                      type="password"
                      placeholder="ghp_..."
                      value={newToken.value}
                      onChange={e =>
                        setNewToken({ ...newToken, value: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddTokenDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={addGithubToken}>Add Token</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={initializeTokensFromEnv}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Initialize from ENV
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {githubTokens.map(token => (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">
                      {token.token_name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        {showTokenValue[token.id]
                          ? token.token_value
                          : '••••••••'}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowTokenValue({
                              ...showTokenValue,
                              [token.id]: !showTokenValue[token.id]
                            })
                          }
                        >
                          {showTokenValue[token.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          token.is_active
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-500 text-white'
                        }
                      >
                        {token.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{token.total_requests}</TableCell>
                    <TableCell>
                      {token.total_requests > 0
                        ? `${((token.successful_requests / token.total_requests) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {token.rate_limit_remaining !== null ? (
                        <span>{token.rate_limit_remaining}</span>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            toggleTokenActive(token.id, token.is_active)
                          }
                        >
                          {token.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteGithubToken(token.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Service Control Tab */}
        <TabsContent value="control" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Scraper Control</h3>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The scraper searches GitHub for Gemini API keys
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button
                    onClick={() => controlService('scraper', 'start')}
                    disabled={loading}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Scraper
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => controlService('scraper', 'restart')}
                    disabled={loading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Restart Scraper
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Validator Control</h3>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The validator checks keys against Gemini models
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button
                    onClick={() => controlService('validator', 'start')}
                    disabled={loading}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Validator
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => controlService('validator', 'restart')}
                    disabled={loading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Restart Validator
                  </Button>
                </div>
              </div>
            </Card>

            {/* Revalidator Tab */}
            <TabsContent value="revalidator" className="space-y-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Revalidator</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This revalidation job checks working_gemini_keys periodically
                  (every 5 minutes via cron) and switches keys between Valid and
                  Quota Exceeded status. Keys that become invalid are removed
                  from the pool.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => controlService('revalidator', 'start')}
                    disabled={loading}
                  >
                    <Play className="w-4 h-4 mr-2" /> Run Revalidator Now
                  </Button>
                </div>
              </Card>
            </TabsContent>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Revalidator Control
              </h3>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The revalidator checks working keys every 5 minutes and
                    toggles status between Valid and Quota Exceeded.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Concurrency
                    </span>
                    <Select
                      value={String(revalidatorConcurrency)}
                      onValueChange={v =>
                        setRevalidatorConcurrency(parseInt(v))
                      }
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue placeholder="5" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() =>
                      controlService('revalidator', 'start', {
                        concurrency: revalidatorConcurrency
                      })
                    }
                    disabled={loading}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Run Revalidator Now
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
