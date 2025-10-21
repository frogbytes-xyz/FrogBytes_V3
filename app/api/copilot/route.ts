import { NextRequest, NextResponse } from 'next/server'
import { retryStreamWithKeyRotation } from '@/lib/api-keys/retry-with-fallback'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:streamGenerateContent'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface CopilotRequest {
  question: string
  context?: string
  history?: Message[]
}

export async function POST(request: NextRequest) {
import { logger } from '@/lib/utils/logger'
  try {
    const body: CopilotRequest = await request.json()
    const { question, context = '', history = [] } = body

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Question is required',
          details: ['Please provide a question'],
        },
        { status: 400 }
      )
    }

    logger.info('[Copilot] Processing question with context length:', context?.length || 0, 'and history length:', history.length)

    // Build conversation history for Gemini
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []

    // Add system context at the beginning if context exists
    if (context && context.trim().length > 0) {
      // Add initial system message with lecture content
      contents.push({
        role: 'user',
        parts: [{
          text: `You are an AI learning assistant helping a student understand lecture content. Here is the lecture material you should reference when answering questions:

---LECTURE CONTENT---
${context}
---END LECTURE CONTENT---

Your role is to:
- Answer questions based on the lecture content above
- Explain concepts clearly with examples when helpful
- Use markdown formatting for better readability (bold, italic, lists, code blocks, etc.)
- Break down complex topics into understandable parts
- Reference specific parts of the lecture when relevant
- If asked something outside the lecture scope, acknowledge the limitation but provide helpful guidance

Please confirm you understand the lecture content.`
        }]
      })
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand the lecture content and am ready to help you study and understand the material. Feel free to ask me any questions about the lecture, request explanations of concepts, or ask for practice problems. How can I help you today?' }]
      })
    }

    // Add conversation history
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })
    }

    // Add current question
    contents.push({
      role: 'user',
      parts: [{ text: question }]
    })

    // Call Gemini API with streaming and automatic retry/fallback
    logger.info('[Copilot] Calling Gemini API with', contents.length, 'messages')

    const { response } = await retryStreamWithKeyRotation(
      async (apiKey: string) => {
        return fetch(`${GEMINI_API_URL}?key=${apiKey}&alt=sse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        })
      },
      {
        maxRetries: 5,
        onRetry: (attempt, error) => {
          logger.info(`[Copilot] Retry attempt ${attempt} due to: ${error.message}`)
        }
      }
    )

    logger.info('[Copilot] Successfully connected to Gemini, starting stream')

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) {
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`)
                    )
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          logger.error('Stream error', error)
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    logger.error('[Copilot] API error after retries', error)

    // Handle retry exhaustion gracefully
    if (error.exhaustedKeys) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI service temporarily unavailable',
          details: ['All available API keys are currently exhausted. Please try again in a few moments.'],
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: [error.message || 'An unexpected error occurred'],
      },
      { status: 500 }
    )
  }
}
