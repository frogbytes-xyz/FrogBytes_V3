/**
 * API Keys Dashboard Page
 * Displays user's API keys with management capabilities
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Key,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Download,
  Eye,
  AlertTriangle,
  TrendingUp,
  Database,
  Zap
} from 'lucide-react'

interface KeyValidationStats {
  totalScraped: number
  totalValidated: number
  totalValid: number
  totalInvalid: number
  pendingValidation: number
  validationProgress: number
  capabilityBreakdown: {
    canGenerateText: number
    canGenerateImages: number
    canProcessVideo: number
    canProcessAudio: number
    canExecuteCode: number
    canCallFunctions: number
    canSearchGrounding: number
  }
}

interface ApiKeyEntry {
  id: string
  api_key: string
  source: string
  source_url?: string
  scraped_at: string
  validation_status: 'pending' | 'validating' | 'processed'
  is_valid?: boolean
  total_models_accessible?: number
  total_models_tested?: number
  best_model?: string
  max_token_limit?: number
  capabilities?: any[]
  validated_at?: string
}

async function getKeyValidationStats(): Promise<KeyValidationStats> {
  // This would be replaced with actual API call
  return {
    totalScraped: 1247,
    totalValidated: 892,
    totalValid: 234,
    totalInvalid: 658,
    pendingValidation: 355,
    validationProgress: 71.5,
    capabilityBreakdown: {
      canGenerateText: 234,
      canGenerateImages: 89,
      canProcessVideo: 156,
      canProcessAudio: 167,
      canExecuteCode: 78,
      canCallFunctions: 123,
      canSearchGrounding: 45
    }
  }
}

async function getApiKeys(
  _page = 1,
  _filters?: any
): Promise<{ keys: ApiKeyEntry[]; total: number }> {
  // This would be replaced with actual API call
  return {
    keys: [
      {
        id: '1',
        api_key: 'AIzaSyExample1...',
        source: 'github',
        source_url: 'https://github.com/user/repo/blob/main/config.js',
        scraped_at: '2025-01-15T10:30:00Z',
        validation_status: 'processed',
        is_valid: true,
        total_models_accessible: 4,
        total_models_tested: 6,
        best_model: 'gemini-2.5-pro',
        max_token_limit: 1048576,
        validated_at: '2025-01-15T11:00:00Z'
      },
      {
        id: '2',
        api_key: 'AIzaSyExample2...',
        source: 'gist',
        source_url: 'https://gist.github.com/user/abc123',
        scraped_at: '2025-01-15T09:15:00Z',
        validation_status: 'processed',
        is_valid: false,
        total_models_accessible: 0,
        total_models_tested: 6,
        validated_at: '2025-01-15T10:45:00Z'
      }
    ],
    total: 1247
  }
}

function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend
}: {
  title: string
  value: string | number
  description: string
  icon: any
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div
            className={`flex items-center text-xs ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Trending {trend}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CapabilityBreakdown({
  breakdown
}: {
  breakdown: KeyValidationStats['capabilityBreakdown']
}) {
  const capabilities = [
    {
      name: 'Text Generation',
      count: breakdown.canGenerateText,
      color: 'bg-blue-500'
    },
    {
      name: 'Image Generation',
      count: breakdown.canGenerateImages,
      color: 'bg-purple-500'
    },
    {
      name: 'Video Processing',
      count: breakdown.canProcessVideo,
      color: 'bg-green-500'
    },
    {
      name: 'Audio Processing',
      count: breakdown.canProcessAudio,
      color: 'bg-yellow-500'
    },
    {
      name: 'Code Execution',
      count: breakdown.canExecuteCode,
      color: 'bg-red-500'
    },
    {
      name: 'Function Calling',
      count: breakdown.canCallFunctions,
      color: 'bg-indigo-500'
    },
    {
      name: 'Search Grounding',
      count: breakdown.canSearchGrounding,
      color: 'bg-pink-500'
    }
  ]

  const maxCount = Math.max(...Object.values(breakdown))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Key Capabilities</CardTitle>
        <CardDescription>
          Distribution of features across valid API keys
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {capabilities.map(capability => (
          <div key={capability.name} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{capability.name}</span>
              <span className="font-medium">{capability.count}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${capability.color} transition-all duration-300`}
                style={{ width: `${(capability.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ApiKeyTable({ keys }: { keys: ApiKeyEntry[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>API Key</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Models</TableHead>
            <TableHead>Best Model</TableHead>
            <TableHead>Max Tokens</TableHead>
            <TableHead>Scraped</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map(key => (
            <TableRow key={key.id}>
              <TableCell className="font-mono text-sm">
                {key.api_key.substring(0, 20)}...
              </TableCell>
              <TableCell>
                <Badge variant="outline">{key.source}</Badge>
              </TableCell>
              <TableCell>
                {key.validation_status === 'processed' ? (
                  <Badge variant={key.is_valid ? 'default' : 'destructive'}>
                    {key.is_valid ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Valid
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Invalid
                      </>
                    )}
                  </Badge>
                ) : key.validation_status === 'validating' ? (
                  <Badge variant="secondary">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Validating
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {key.is_valid
                  ? `${key.total_models_accessible}/${key.total_models_tested}`
                  : '-'}
              </TableCell>
              <TableCell>
                {key.best_model ? (
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                    {key.best_model}
                  </code>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell>
                {key.max_token_limit
                  ? key.max_token_limit.toLocaleString()
                  : '-'}
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {new Date(key.scraped_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex space-x-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>API Key Details</DialogTitle>
                        <DialogDescription>
                          Detailed information and capabilities for this API key
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">API Key</label>
                          <code className="block text-sm bg-gray-100 p-2 rounded font-mono">
                            {key.api_key}
                          </code>
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Source URL
                          </label>
                          <a
                            href={key.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-blue-600 hover:underline"
                          >
                            {key.source_url}
                          </a>
                        </div>
                        {key.capabilities && (
                          <div>
                            <label className="text-sm font-medium">
                              Model Capabilities
                            </label>
                            <div className="mt-2 space-y-2">
                              {key.capabilities.map(
                                (capability: any, index: number) => (
                                  <div
                                    key={index}
                                    className="border rounded p-2"
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium">
                                        {capability.modelName}
                                      </span>
                                      <Badge
                                        variant={
                                          capability.isAccessible
                                            ? 'default'
                                            : 'destructive'
                                        }
                                      >
                                        {capability.isAccessible
                                          ? 'Accessible'
                                          : 'Blocked'}
                                      </Badge>
                                    </div>
                                    {capability.features && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {capability.features.map(
                                          (feature: string) => (
                                            <Badge
                                              key={feature}
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {feature}
                                            </Badge>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function ApiKeysPage() {
  const stats = await getKeyValidationStats()
  const { keys } = await getApiKeys()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            API Key Management
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage scraped Gemini API keys and their capabilities
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Keys
          </Button>
          <Button>
            <RefreshCw className="w-4 h-4 mr-2" />
            Run Validation
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Total Scraped"
          value={stats.totalScraped.toLocaleString()}
          description="API keys discovered"
          icon={Database}
          trend="up"
        />
        <StatsCard
          title="Validated"
          value={stats.totalValidated.toLocaleString()}
          description="Keys processed"
          icon={CheckCircle}
          trend="up"
        />
        <StatsCard
          title="Valid Keys"
          value={stats.totalValid.toLocaleString()}
          description="Working API keys"
          icon={Key}
          trend="neutral"
        />
        <StatsCard
          title="Invalid Keys"
          value={stats.totalInvalid.toLocaleString()}
          description="Non-working keys"
          icon={XCircle}
          trend="neutral"
        />
        <StatsCard
          title="Pending"
          value={stats.pendingValidation.toLocaleString()}
          description="Awaiting validation"
          icon={Clock}
          trend="down"
        />
      </div>

      {/* Validation Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Progress</CardTitle>
          <CardDescription>
            Overall progress of API key validation across all sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Validation Progress</span>
              <span>{stats.validationProgress.toFixed(1)}%</span>
            </div>
            <Progress value={stats.validationProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stats.totalValidated} validated</span>
              <span>{stats.pendingValidation} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Tabs defaultValue="all" className="space-y-4">
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="all">All Keys</TabsTrigger>
                <TabsTrigger value="valid">Valid Only</TabsTrigger>
                <TabsTrigger value="invalid">Invalid Only</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
              </TabsList>
              <div className="flex space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search keys..." className="pl-8 w-64" />
                </div>
                <Select>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="gist">Gists</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="all" className="space-y-4">
              <ApiKeyTable keys={keys} />
            </TabsContent>

            <TabsContent value="valid" className="space-y-4">
              <ApiKeyTable keys={keys.filter(k => k.is_valid)} />
            </TabsContent>

            <TabsContent value="invalid" className="space-y-4">
              <ApiKeyTable keys={keys.filter(k => k.is_valid === false)} />
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <ApiKeyTable
                keys={keys.filter(k => k.validation_status === 'pending')}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <CapabilityBreakdown breakdown={stats.capabilityBreakdown} />

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline">
                <Zap className="w-4 h-4 mr-2" />
                Validate Pending Keys
              </Button>
              <Button className="w-full" variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Re-validate Failed Keys
              </Button>
              <Button className="w-full" variant="outline">
                <Database className="w-4 h-4 mr-2" />
                Start New Scraping
              </Button>
            </CardContent>
          </Card>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Rate Limiting</AlertTitle>
            <AlertDescription>
              Validation is rate-limited to avoid API quotas. Large batches may
              take time to complete.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
