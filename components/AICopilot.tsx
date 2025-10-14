'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import MarkdownMessage from '@/components/MarkdownMessage'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface AICopilotProps {
  documentContext?: string
  isFocusMode?: boolean
}

export default function AICopilot({ documentContext, isFocusMode = false }: AICopilotProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          context: documentContext,
          history: messages,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details?.[0] || errorData.error || 'Failed to get response')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream available')
      }

      let assistantMessage = ''

      // Add placeholder message
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '' },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.text) {
                assistantMessage += data.text
                // Update the last message (assistant's response)
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantMessage,
                  }
                  return updated
                })
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // Request was cancelled
      }
      console.error('Copilot error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get response')
      // Remove placeholder message on error
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setError(null)
  }

  const handleSuggestion = (text: string) => {
    setInput(text)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - Minimal and Clean */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-semibold ${isFocusMode ? 'text-2xl' : 'text-lg'}`}>AI Copilot</h3>
            <p className={`text-muted-foreground ${isFocusMode ? 'text-sm' : 'text-xs'} mt-0.5`}>
              Ask questions about your lecture
            </p>
          </div>
          {messages.length > 0 && (
            <Button
              onClick={clearChat}
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-background to-muted/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto px-4">
            {/* Hero Section */}
            <div className="text-center space-y-3 mb-12">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted border-2 border-border mb-4 shadow-sm">
                <svg
                  className="h-10 w-10 text-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h4 className={`font-semibold text-foreground ${isFocusMode ? 'text-2xl' : 'text-xl'}`}>
                Start a Conversation
              </h4>
              <p className={`text-muted-foreground max-w-md mx-auto ${isFocusMode ? 'text-base' : 'text-sm'}`}>
                {documentContext
                  ? "Ask me anything about your lecture. I'll help you understand concepts, summarize content, or create study materials."
                  : "I'm ready to help! Note: No lecture content is loaded, so I'll provide general assistance."
                }
              </p>
              {documentContext && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium text-primary">Lecture content loaded</span>
                </div>
              )}
            </div>
            
            {/* Suggestion Cards - 2x2 Grid */}
            <div className="w-full max-w-2xl">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                Quick Suggestions
              </p>
              <div className={`grid gap-3 ${isFocusMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {[
                  { 
                    text: 'Summarize the main points',
                    icon: (
                      <svg className={`${isFocusMode ? 'h-6 w-6' : 'h-5 w-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )
                  },
                  { 
                    text: 'Explain key concepts',
                    icon: (
                      <svg className={`${isFocusMode ? 'h-6 w-6' : 'h-5 w-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )
                  },
                  { 
                    text: 'Create practice questions',
                    icon: (
                      <svg className={`${isFocusMode ? 'h-6 w-6' : 'h-5 w-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )
                  },
                  { 
                    text: 'Clarify difficult topics',
                    icon: (
                      <svg className={`${isFocusMode ? 'h-6 w-6' : 'h-5 w-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )
                  }
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(suggestion.text)}
                    className={`group relative overflow-hidden text-left rounded-xl border border-border bg-card hover:border-border/80 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 ${
                      isFocusMode ? 'px-6 py-5' : 'px-4 py-3'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 text-muted-foreground group-hover:text-foreground">
                        {suggestion.icon}
                      </span>
                      <span className={`font-medium text-foreground ${
                        isFocusMode ? 'text-base' : 'text-sm'
                      }`}>
                        {suggestion.text}
                      </span>
                    </div>
                    {/* Subtle hover effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-muted/0 to-muted/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={`space-y-4 ${isFocusMode ? 'max-w-4xl mx-auto' : ''}`}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 rounded-full flex items-center justify-center border ${
                  isFocusMode ? 'h-10 w-10' : 'h-8 w-8'
                } ${
                  message.role === 'user'
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-muted border-border text-foreground'
                }`}>
                  {message.role === 'user' ? (
                    <svg className={`${isFocusMode ? 'h-5 w-5' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ) : (
                    <svg className={`${isFocusMode ? 'h-5 w-5' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  )}
                </div>

                {/* Message bubble */}
                <div className={`flex-1 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className={`inline-block max-w-[85%] rounded-2xl border shadow-sm ${
                    isFocusMode ? 'px-6 py-4' : 'px-4 py-3'
                  } ${
                    message.role === 'user'
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-card border-border text-card-foreground'
                  }`}>
                    {message.role === 'user' ? (
                      <p className={`leading-relaxed whitespace-pre-wrap ${
                        isFocusMode ? 'text-base' : 'text-sm'
                      }`}>
                        {message.content}
                      </p>
                    ) : (
                      <MarkdownMessage
                        content={message.content}
                        className={isFocusMode ? 'text-base' : 'text-sm'}
                      />
                    )}
                    {message.role === 'assistant' && isLoading && index === messages.length - 1 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 pb-4">
          <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl shadow-sm">
            <svg className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-destructive text-sm">Error</p>
              <p className="text-sm text-destructive/90 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-destructive/60 hover:text-destructive transition-colors p-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Input - Elevated and Modern */}
      <form onSubmit={handleSubmit} className="p-6 border-t border-border bg-background">
        <div className={`flex gap-2 ${isFocusMode ? 'max-w-4xl mx-auto' : ''}`}>
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1 rounded-xl shadow-sm"
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={handleStop}
              variant="outline"
              size="default"
              className="px-6 rounded-xl shadow-sm"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              size="default"
              className="px-6 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
