'use client'

import { logger } from '@/lib/utils/logger'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabase/client'
import Menubar from '@/components/layout/Menubar'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDistanceToNow } from 'date-fns'
import {
  Bug,
  Sparkles,
  Wrench,
  ThumbsUp as ThumbsUpIcon,
  ThumbsDown as ThumbsDownIcon,
  Heart,
  Rocket,
  Eye,
  HelpCircle,
  PartyPopper,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Circle,
  CheckCircle2,
  Search,
  Plus,
  X,
  Loader2
} from 'lucide-react'

interface Label {
  id: string
  name: string
  color: string
  description?: string
}

interface Feedback {
  id: string
  user_id: string
  type: 'issue' | 'improvement' | 'feature'
  title: string
  description: string
  status: 'open' | 'in_progress' | 'completed' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  upvotes: number
  downvotes: number
  created_at: string
  updated_at: string
  assignee_id?: string
  reaction_counts: Record<string, number>
  users?: {
    email: string
    full_name?: string
  }
  assignee?: {
    email: string
    full_name?: string
  }
  user_vote?: 'up' | 'down' | null
  reply_count?: number
  labels?: Label[]
  user_reactions?: string[]
}

interface Reply {
  id: string
  feedback_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  users?: {
    email: string
    full_name?: string
  }
}

const reactionIcons: Record<string, any> = {
  thumbs_up: ThumbsUpIcon,
  thumbs_down: ThumbsDownIcon,
  heart: Heart,
  hooray: PartyPopper,
  confused: HelpCircle,
  rocket: Rocket,
  eyes: Eye
}

const typeConfig = {
  issue: { icon: Bug, label: 'Bug', color: 'text-red-600 bg-red-50 border-red-200' },
  feature: { icon: Sparkles, label: 'Feature', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  improvement: { icon: Wrench, label: 'Improvement', color: 'text-green-600 bg-green-50 border-green-200' }
}

const priorityConfig = {
  low: { color: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium: { color: 'bg-blue-100 text-blue-600 border-blue-200' },
  high: { color: 'bg-orange-100 text-orange-600 border-orange-200' },
  urgent: { color: 'bg-red-100 text-red-600 border-red-200' }
}

export default function FeedbackPage() {
  const supabase = createClient()
  const supabaseAny = supabase as any
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tablesExist, setTablesExist] = useState(false)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Filters
  const [filter, setFilter] = useState<'all' | 'issue' | 'improvement' | 'feature'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [labelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy] = useState<'recent' | 'popular' | 'updated'>('updated')

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newFeedback, setNewFeedback] = useState({
    type: 'improvement' as 'issue' | 'improvement' | 'feature',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    selectedLabels: [] as string[],
  })
  const [newReply, setNewReply] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (tablesExist) {
      loadLabels()
      loadFeedbacks()
    }
  }, [user, filter, statusFilter, labelFilter, sortBy, tablesExist])

  // Debounced search effect
  useEffect(() => {
    if (!tablesExist) return

    const debounceTimer = setTimeout(() => {
      loadFeedbacks()
    }, 300) // Wait 300ms after user stops typing

    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    await checkTables()
    setLoading(false)
  }

  async function checkTables() {
    try {
      const { error } = await supabase
        .from('feedback')
        .select('count')
        .limit(1)

      setTablesExist(!error)
    } catch (error) {
      logger.error('Tables do not exist', error)
      setTablesExist(false)
    }
  }

  async function loadLabels() {
    try {
      const { data, error } = await supabase
        .from('feedback_labels')
        .select('*')
        .order('name')

      if (!error && data) {
        setLabels(data)
      }
    } catch (error) {
      logger.error('Error loading labels', error)
    }
  }

  async function loadFeedbacks() {
    try {
      setIsSearching(true)
      let query = supabase
        .from('feedback')
        .select('*')

      if (filter !== 'all') {
        query = query.eq('type', filter)
      }

      if (statusFilter === 'open') {
        query = query.in('status', ['open', 'in_progress'])
      } else if (statusFilter === 'closed') {
        query = query.in('status', ['completed', 'closed'])
      }

      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      }

      if (sortBy === 'popular') {
        query = query.order('upvotes', { ascending: false })
      } else if (sortBy === 'recent') {
        query = query.order('created_at', { ascending: false })
      } else {
        query = query.order('updated_at', { ascending: false })
      }

      const { data, error } = await query

      if (error) throw error

      if (user && data) {
        const feedbackData = data as Feedback[]
        const feedbackIds = feedbackData.map(f => f.id)
        const userIds = [...new Set(feedbackData.map(f => f.user_id).concat(feedbackData.map(f => f.assignee_id).filter((id): id is string => Boolean(id))))]

        const [votes, reactions, replies, labelAssignments, usersData] = await Promise.all([
          supabase
            .from('feedback_votes')
            .select('feedback_id, vote_type')
            .eq('user_id', user.id)
            .in('feedback_id', feedbackIds),

          supabase
            .from('feedback_reactions')
            .select('feedback_id, reaction_type')
            .eq('user_id', user.id)
            .in('feedback_id', feedbackIds),

          supabase
            .from('feedback_replies')
            .select('feedback_id')
            .in('feedback_id', feedbackIds),

          supabase
            .from('feedback_label_assignments')
            .select(`
              feedback_id,
              feedback_labels (id, name, color, description)
            `)
            .in('feedback_id', feedbackIds),

          supabase
            .from('users')
            .select('id, email, full_name')
            .in('id', userIds)
        ])

        const voteMap = new Map((votes.data || []).map((v: {feedback_id: string, vote_type: string}) => [v.feedback_id, v.vote_type]))
        
        const userMap = new Map((usersData.data || []).map((u: {id: string}) => [u.id, u]))

        const reactionMap = new Map<string, string[]>()
        ;(reactions.data || []).forEach((r: {feedback_id: string, reaction_type: string}) => {
          if (!reactionMap.has(r.feedback_id)) {
            reactionMap.set(r.feedback_id, [])
          }
          reactionMap.get(r.feedback_id)?.push(r.reaction_type)
        })

        const replyCountMap = new Map<string, number>()
        ;(replies.data || []).forEach((r: {feedback_id: string}) => {
          replyCountMap.set(r.feedback_id, (replyCountMap.get(r.feedback_id) || 0) + 1)
        })

        const labelMap = new Map<string, unknown[]>()
        ;(labelAssignments.data || []).forEach((la: {feedback_id: string, feedback_labels: unknown}) => {
          if (!labelMap.has(la.feedback_id)) {
            labelMap.set(la.feedback_id, [])
          }
          labelMap.get(la.feedback_id)?.push(la.feedback_labels)
        })

        const feedbackWithData = data.map((f: Feedback) => ({
          ...f,
          users: userMap.get(f.user_id) || null,
          assignee: f.assignee_id ? userMap.get(f.assignee_id) : null,
          user_vote: voteMap.get(f.id) || null,
          user_reactions: reactionMap.get(f.id) || [],
          reply_count: replyCountMap.get(f.id) || 0,
          labels: labelMap.get(f.id) || [],
        }))

        let filteredFeedback = feedbackWithData
        if (labelFilter !== 'all') {
          filteredFeedback = feedbackWithData.filter(f => {
            const labels = f.labels as unknown as Label[]
            return Array.isArray(labels) && labels.some((l: Label) => l.id === labelFilter)
          })
        }

        setFeedbacks(filteredFeedback as unknown as Feedback[])
      } else if (data) {
        // No user logged in - still fetch user data for display
        const feedbackData = data as Feedback[]
        const userIds = [...new Set(feedbackData.map(f => f.user_id).concat(feedbackData.map(f => f.assignee_id).filter((id): id is string => Boolean(id))))]
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', userIds)
        
        const userMap = new Map((usersData || []).map((u: {id: string}) => [u.id, u]))
        
        const feedbackWithUsers = data.map((f: Feedback) => ({
          ...f,
          users: userMap.get(f.user_id) || null,
          assignee: f.assignee_id ? userMap.get(f.assignee_id) : null,
        }))
        
        setFeedbacks(feedbackWithUsers as unknown as Feedback[])
      } else {
        setFeedbacks([])
      }
    } catch (error) {
      logger.error('Error loading feedbacks', error)
    } finally {
      setIsSearching(false)
    }
  }

  async function handleReaction(feedbackId: string, reactionType: string) {
    if (!user) {
      alert('Please sign in to react')
      return
    }

    try {
      const feedback = feedbacks.find(f => f.id === feedbackId)
      if (!feedback) return

      const hasReaction = feedback.user_reactions?.includes(reactionType)

      if (hasReaction) {
        await supabaseAny
          .from('feedback_reactions')
          .delete()
          .eq('feedback_id', feedbackId)
          .eq('user_id', user.id)
          .eq('reaction_type', reactionType)
      } else {
        await supabaseAny
          .from('feedback_reactions')
          .insert({
            feedback_id: feedbackId,
            user_id: user.id,
            reaction_type: reactionType,
          } as any)
      }

      loadFeedbacks()
    } catch (error) {
      logger.error('Error handling reaction', error)
    }
  }

  async function loadReplies(feedbackId: string) {
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        const replyData = data as Reply[]
        const userIds = [...new Set(replyData.map(r => r.user_id).filter(Boolean))]
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', userIds)
        
        const userMap = new Map((usersData || []).map((u: {id: string}) => [u.id, u]))
        
        const repliesWithUsers = data.map((r: {user_id: string, id: string}) => ({
          ...r,
          users: userMap.get(r.user_id) || null,
        }))
        
        setReplies(repliesWithUsers as unknown as Reply[])
      } else {
        setReplies(data || [])
      }
    } catch (error) {
      logger.error('Error loading replies', error)
    }
  }

  async function handleCreateFeedback() {
    if (!user) {
      alert('Please sign in to create feedback')
      return
    }

    if (!newFeedback.title || !newFeedback.description) {
      alert('Please fill in all fields')
      return
    }

    try {
      const { data: feedbackData, error } = await (supabase as any)
        .from('feedback')
        .insert({
          user_id: user.id,
          type: newFeedback.type,
          title: newFeedback.title,
          description: newFeedback.description,
          priority: newFeedback.priority,
          status: 'open',
          upvotes: 0,
          downvotes: 0,
        } as any)
        .select()

      if (error) {
        logger.error('Database error', error)
        alert(`Failed to create feedback: ${error.message}`)
        return
      }

      if (newFeedback.selectedLabels.length > 0 && feedbackData?.[0]) {
        const feedbackId = feedbackData?.[0]?.id
        if (feedbackId) {
          const labelAssignments = newFeedback.selectedLabels.map(labelId => ({
            feedback_id: feedbackId,
            label_id: labelId,
          }))

          await (supabase as any)
            .from('feedback_label_assignments')
            .insert(labelAssignments as any)
        }
      }

      setNewFeedback({
        type: 'improvement',
        title: '',
        description: '',
        priority: 'medium',
        selectedLabels: [],
      })
      setShowCreateForm(false)
      loadFeedbacks()
    } catch (error) {
      logger.error('Error creating feedback', error)
      alert(`Failed to create feedback: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async function handleVote(feedbackId: string, voteType: 'up' | 'down') {
    if (!user) {
      alert('Please sign in to vote')
      return
    }

    try {
      const feedback = feedbacks.find(f => f.id === feedbackId)
      if (!feedback) return

      if (feedback.user_vote === voteType) {
        await supabaseAny
          .from('feedback_votes')
          .delete()
          .eq('feedback_id', feedbackId)
          .eq('user_id', user.id)
      } else if (feedback.user_vote) {
        await supabaseAny
          .from('feedback_votes')
          .update({ vote_type: voteType } as any)
          .eq('feedback_id', feedbackId)
          .eq('user_id', user.id)
      } else {
        await supabaseAny
          .from('feedback_votes')
          .insert({
            feedback_id: feedbackId,
            user_id: user.id,
            vote_type: voteType,
          } as any)
      }

      loadFeedbacks()
    } catch (error) {
      logger.error('Error voting', error)
    }
  }

  async function handleCreateReply() {
    if (!user || !selectedFeedback || !newReply.trim()) {
      return
    }

    try {
      const { error } = await supabaseAny
        .from('feedback_replies')
        .insert({
          feedback_id: selectedFeedback.id,
          user_id: user.id,
          content: newReply,
        } as any)

      if (error) throw error

      setNewReply('')
      loadReplies(selectedFeedback.id)
      loadFeedbacks()
    } catch (error) {
      logger.error('Error creating reply', error)
      alert('Failed to create reply')
    }
  }

  const getOpenIssuesCount = () => {
    return feedbacks.filter(f => f.status === 'open' || f.status === 'in_progress').length
  }

  const getClosedIssuesCount = () => {
    return feedbacks.filter(f => f.status === 'completed' || f.status === 'closed').length
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Menubar />

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="pt-20 pb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-normal mb-3 text-foreground">Issues</h1>
              <p className="text-lg text-muted-foreground">
                Track bugs, request features, and suggest improvements
              </p>
            </div>
            {user && (
              <Button onClick={() => setShowCreateForm(!showCreateForm)} size="lg">
                <Plus className="w-4 h-4 mr-2" />
                {showCreateForm ? 'Cancel' : 'New Issue'}
              </Button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="bg-gradient-to-b from-muted/5 to-background border border-border/30 rounded-2xl p-6 space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-20 h-12"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isSearching && (
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  )}
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                      title="Clear search"
                    >
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Search Results Indicator */}
            {searchQuery.trim() && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Search results for <span className="font-medium text-foreground">"{searchQuery}"</span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="h-8"
                >
                  Clear search
                </Button>
              </div>
            )}

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                  className="h-10"
                >
                  All ({feedbacks.length})
                </Button>
                <Button
                  variant={statusFilter === 'open' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('open')}
                  className="h-10"
                >
                  <Circle className="w-3 h-3 mr-1.5" />
                  Open ({getOpenIssuesCount()})
                </Button>
                <Button
                  variant={statusFilter === 'closed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('closed')}
                  className="h-10"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1.5" />
                  Closed ({getClosedIssuesCount()})
                </Button>
              </div>

              <div className="h-6 w-px bg-border/50" />

              {/* Type Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="h-10"
                >
                  All Types
                </Button>
                <Button
                  variant={filter === 'issue' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('issue')}
                  className="h-10"
                >
                  <Bug className="w-3 h-3 mr-1.5" />
                  Bugs
                </Button>
                <Button
                  variant={filter === 'feature' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('feature')}
                  className="h-10"
                >
                  <Sparkles className="w-3 h-3 mr-1.5" />
                  Features
                </Button>
                <Button
                  variant={filter === 'improvement' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('improvement')}
                  className="h-10"
                >
                  <Wrench className="w-3 h-3 mr-1.5" />
                  Improvements
                </Button>
              </div>
            </div>
          </div>
        </div>

        {!tablesExist ? (
          <Card className="border bg-background rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg font-normal">Setup Required</CardTitle>
              <CardDescription>
                The feedback system tables need to be created in your database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <p className="text-sm font-medium">To set up the feedback system:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Go to your Supabase dashboard</li>
                  <li>Navigate to the SQL Editor</li>
                  <li>Copy and run the SQL from both migration files:</li>
                  <li className="ml-4">• <code className="bg-background px-1">create_feedback_tables.sql</code></li>
                  <li className="ml-4">• <code className="bg-background px-1">20250115000000_enhance_feedback_system.sql</code></li>
                  <li>Refresh this page</li>
                </ol>
              </div>
              <Button onClick={() => checkTables()} size="sm">
                Check Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Create Form */}
            {showCreateForm && (
              <Card className="border border-border/30 bg-gradient-to-b from-muted/5 to-background rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl font-normal">Create New Issue</CardTitle>
                  <CardDescription className="text-base">
                    Describe the bug, feature, or improvement you'd like to see
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <select
                        value={newFeedback.type}
                        onChange={(e) => setNewFeedback({ ...newFeedback, type: e.target.value as any })}
                        className="h-10 w-full px-4 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="issue">Bug Report</option>
                        <option value="feature">Feature Request</option>
                        <option value="improvement">Improvement</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority</label>
                      <select
                        value={newFeedback.priority}
                        onChange={(e) => setNewFeedback({ ...newFeedback, priority: e.target.value as any })}
                        className="h-10 w-full px-4 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={newFeedback.title}
                      onChange={(e) => setNewFeedback({ ...newFeedback, title: e.target.value })}
                      placeholder="Brief, descriptive title for your issue"
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      value={newFeedback.description}
                      onChange={(e) => setNewFeedback({ ...newFeedback, description: e.target.value })}
                      placeholder="Detailed description of the issue or feature request..."
                      className="w-full min-h-[140px] px-4 py-3 text-sm border border-border rounded-lg bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {labels.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Labels (optional)</label>
                      <div className="flex flex-wrap gap-2">
                        {labels.map((label) => (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => {
                              const isSelected = newFeedback.selectedLabels.includes(label.id)
                              setNewFeedback({
                                ...newFeedback,
                                selectedLabels: isSelected
                                  ? newFeedback.selectedLabels.filter(id => id !== label.id)
                                  : [...newFeedback.selectedLabels, label.id]
                              })
                            }}
                            className={`px-3 py-1.5 text-xs border rounded-lg transition-all ${
                              newFeedback.selectedLabels.includes(label.id)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:bg-muted/50'
                            }`}
                            style={{
                              backgroundColor: newFeedback.selectedLabels.includes(label.id)
                                ? `${label.color}20`
                                : undefined,
                              borderColor: newFeedback.selectedLabels.includes(label.id)
                                ? label.color
                                : undefined
                            }}
                          >
                            {label.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-4">
                    <Button onClick={handleCreateFeedback} size="lg" className="flex-1">
                      Create Issue
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Issues Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Issues List */}
              <div className="lg:col-span-2 space-y-3">
                {feedbacks.length === 0 ? (
                  <Card className="border border-border/30 bg-gradient-to-b from-muted/5 to-background rounded-2xl">
                    <CardContent className="p-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                          <MessageCircle className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-lg font-medium mb-2">No issues found</p>
                          <p className="text-sm text-muted-foreground">
                            {user ? "Be the first to create an issue!" : "Sign in to create issues"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  feedbacks.map((feedback) => {
                    const TypeIcon = typeConfig[feedback.type].icon
                    const isOpen = feedback.status === 'open' || feedback.status === 'in_progress'

                    return (
                      <Card
                        key={feedback.id}
                        className={`border border-border/30 bg-gradient-to-b from-muted/5 to-background rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] ${
                          selectedFeedback?.id === feedback.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => {
                          setSelectedFeedback(feedback)
                          loadReplies(feedback.id)
                        }}
                      >
                        <CardContent className="p-5">
                          <div className="flex gap-4">
                            {/* Status Icon & Voting */}
                            <div className="flex flex-col items-center gap-2 min-w-[48px]">
                              {/* Status Icon */}
                              <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                                isOpen
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-purple-100 text-purple-600'
                              }`}>
                                {isOpen ? (
                                  <Circle className="h-3.5 w-3.5 fill-current" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                              </div>

                              {/* Vote Score */}
                              <div className="text-xs font-medium text-muted-foreground">
                                {feedback.upvotes - feedback.downvotes > 0 && '+'}
                                {feedback.upvotes - feedback.downvotes}
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Title and Type Badge */}
                              <div className="flex items-start gap-2 mb-2">
                                <h3 className="font-medium text-base leading-snug line-clamp-2 flex-1">
                                  {feedback.title}
                                </h3>
                              </div>

                              {/* Badges */}
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-md ${typeConfig[feedback.type].color}`}>
                                  <TypeIcon className="w-3 h-3" />
                                  {typeConfig[feedback.type].label}
                                </div>
                                <div className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-md ${priorityConfig[feedback.priority].color}`}>
                                  {feedback.priority}
                                </div>
                                {feedback.labels?.map((label) => (
                                  <span
                                    key={label.id}
                                    className="inline-block px-2 py-0.5 text-xs font-medium border rounded-md"
                                    style={{
                                      backgroundColor: `${label.color}20`,
                                      borderColor: label.color,
                                      color: label.color
                                    }}
                                  >
                                    {label.name}
                                  </span>
                                ))}
                              </div>

                              {/* Description */}
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                {feedback.description}
                              </p>

                              {/* Meta */}
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <span>
                                    #{feedback.id.slice(-6)} opened{' '}
                                    {formatDistanceToNow(new Date(feedback.created_at), { addSuffix: true })}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {feedback.users?.full_name || feedback.users?.email}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Reactions */}
                                  {Object.entries(feedback.reaction_counts || {}).map(([type, count]) => {
                                    const ReactionIcon = reactionIcons[type]
                                    if (!ReactionIcon || count === 0) return null
                                    return (
                                      <button
                                        key={type}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleReaction(feedback.id, type)
                                        }}
                                        className={`flex items-center gap-1 px-1.5 py-0.5 border rounded-md transition-colors hover:bg-muted ${
                                          feedback.user_reactions?.includes(type)
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border'
                                        }`}
                                      >
                                        <ReactionIcon className="w-3 h-3" />
                                        <span>{count}</span>
                                      </button>
                                    )
                                  })}

                                  {/* Reply count */}
                                  {feedback.reply_count! > 0 && (
                                    <span className="flex items-center gap-1">
                                      <MessageCircle className="h-3 w-3" />
                                      {feedback.reply_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-1">
                {selectedFeedback ? (
                  <Card className="border border-border/30 bg-gradient-to-b from-muted/5 to-background rounded-2xl sticky top-6">
                    <CardHeader className="pb-4">
                      {/* Status Badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                          selectedFeedback.status === 'open' || selectedFeedback.status === 'in_progress'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-purple-100 text-purple-600'
                        }`}>
                          {selectedFeedback.status === 'open' || selectedFeedback.status === 'in_progress' ? (
                            <Circle className="h-3 w-3 fill-current" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {selectedFeedback.status === 'open' ? 'Open' :
                           selectedFeedback.status === 'in_progress' ? 'In Progress' :
                           selectedFeedback.status === 'completed' ? 'Completed' : 'Closed'}
                        </span>
                      </div>

                      <CardTitle className="text-lg font-medium leading-snug">
                        {selectedFeedback.title}
                      </CardTitle>

                      <div className="text-xs text-muted-foreground">
                        #{selectedFeedback.id.slice(-6)} opened by{' '}
                        {selectedFeedback.users?.full_name || selectedFeedback.users?.email} •{' '}
                        {formatDistanceToNow(new Date(selectedFeedback.created_at), { addSuffix: true })}
                      </div>

                      {/* Labels */}
                      {selectedFeedback.labels && selectedFeedback.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-3">
                          {selectedFeedback.labels.map((label) => (
                            <span
                              key={label.id}
                              className="inline-block px-2 py-0.5 text-xs font-medium border rounded-md"
                              style={{
                                backgroundColor: `${label.color}20`,
                                borderColor: label.color,
                                color: label.color
                              }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Description */}
                      <div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {selectedFeedback.description}
                        </p>
                      </div>

                      {/* Voting */}
                      {user && (
                        <div className="flex items-center gap-2 py-3 border-t">
                          <button
                            onClick={() => handleVote(selectedFeedback.id, 'up')}
                            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-all hover:bg-muted ${
                              selectedFeedback.user_vote === 'up' ? 'border-primary bg-primary/10 text-primary' : 'border-border'
                            }`}
                          >
                            <ChevronUp className="h-4 w-4" />
                            <span>{selectedFeedback.upvotes}</span>
                          </button>

                          <button
                            onClick={() => handleVote(selectedFeedback.id, 'down')}
                            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-all hover:bg-muted ${
                              selectedFeedback.user_vote === 'down' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border'
                            }`}
                          >
                            <ChevronDown className="h-4 w-4" />
                            <span>{selectedFeedback.downvotes}</span>
                          </button>

                          <div className="text-xs text-muted-foreground ml-2">
                            Score: {selectedFeedback.upvotes - selectedFeedback.downvotes}
                          </div>
                        </div>
                      )}

                      {/* Comments */}
                      <div className="border-t pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            Comments ({replies.length})
                          </h4>
                        </div>

                        {/* Comments List */}
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {replies.map((reply) => (
                            <div key={reply.id} className="bg-muted/30 border border-border/30 p-3 rounded-lg text-sm">
                              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                <span className="font-medium">
                                  {reply.users?.full_name || reply.users?.email}
                                </span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                            </div>
                          ))}
                        </div>

                        {/* Comment Form */}
                        {user && (
                          <div className="space-y-3">
                            <textarea
                              value={newReply}
                              onChange={(e) => setNewReply(e.target.value)}
                              placeholder="Add a comment..."
                              className="w-full min-h-[100px] px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <Button
                              onClick={handleCreateReply}
                              size="sm"
                              className="w-full"
                              disabled={!newReply.trim()}
                            >
                              Comment
                            </Button>
                          </div>
                        )}

                        {!user && (
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">
                              <a href="/login" className="text-primary hover:underline">
                                Sign in
                              </a>{' '}
                              to comment on this issue
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-border/30 bg-gradient-to-b from-muted/5 to-background rounded-2xl">
                    <CardContent className="p-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                          <MessageCircle className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium mb-2">No issue selected</p>
                          <p className="text-sm text-muted-foreground">
                            Select an issue from the list to view details
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <Footer />
    </main>
  )
}
