/**
 * Gemini API Integration for AI Summarization
 *
 * This module handles communication with Google's Gemini API for text summarization.
 * Uses a pool of API keys from the database for parallel processing.
 */

import { getKeyForTextGeneration, getKeysForParallelProcessing, markKeySuccess, markKeyQuotaExceeded, markKeyInvalid } from '@/lib/api-keys/key-pool-service'

export type SummaryType = 'compact' | 'detailed' | 'expanded'

export interface SummarizationRequest {
  text: string
  summaryType: SummaryType
}

export interface SummarizationResult {
  latexContent: string
  totalTokens: number
  chunkCount: number
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent'

// Token limits for chunking (Gemini 2.0 Flash has high limits)
const MAX_TOKENS_PER_CHUNK = 30000
const CHARS_PER_TOKEN = 4 // Rough estimate

const SUMMARY_PROMPTS: Record<SummaryType, string> = {
  compact: `Summarize the following lecture transcript into a compact, concise LaTeX document (about 50% of original length).
Focus on the most essential concepts and key points only.
Format the output as LaTeX content (do not include \\documentclass, \\begin{document}, or \\end{document}).
Use LaTeX sections (\\section), subsections (\\subsection), and itemize/enumerate lists.
Include important equations using LaTeX math mode.
Make it suitable for quick review.`,
  
  detailed: `Summarize the following lecture transcript into a detailed LaTeX document (about 80% of original length).
Include all major concepts, explanations, and examples.
Format the output as LaTeX content (do not include \\documentclass, \\begin{document}, or \\end{document}).
Use LaTeX sections (\\section), subsections (\\subsection), itemize/enumerate lists, and descriptions.
Include all equations and formulas using LaTeX math mode.
Preserve important details and context.`,
  
  expanded: `Summarize and expand the following lecture transcript into a comprehensive LaTeX document (about 120% of original length).
Include all concepts with enhanced explanations and additional context.
Format the output as LaTeX content (do not include \\documentclass, \\begin{document}, or \\end{document}).
Use LaTeX sections (\\section), subsections (\\subsection), subsubsections (\\subsubsection), itemize/enumerate lists, and descriptions.
Include all equations with detailed explanations using LaTeX math mode.
Add clarifying notes and connections between topics.
Make it suitable for comprehensive study.`,
}

/**
 * Chunk text into smaller pieces that fit within token limits
 */
function chunkText(text: string, maxChunkSize: number = MAX_TOKENS_PER_CHUNK): string[] {
  const maxChars = maxChunkSize * CHARS_PER_TOKEN
  const chunks: string[] = []
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

/**
 * Call Gemini API to summarize a chunk of text
 * Automatically selects an available API key from the pool
 */
async function summarizeChunk(
  chunk: string,
  summaryType: SummaryType,
  chunkIndex: number,
  totalChunks: number,
  apiKey?: string, // Optional: use specific key
  retryCount: number = 0
): Promise<string> {
  const MAX_RETRIES = 3
  const backoff = (attempt: number) => new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)))

  // Select API key (use provided or from pool)
  const key = apiKey || await getKeyForTextGeneration()

  if (!key) {
    throw new Error('No available Gemini API keys. Please add keys to the pool or set GEMINI_API_KEY environment variable.')
  }

  const prompt = SUMMARY_PROMPTS[summaryType]
  const chunkContext = totalChunks > 1 
    ? `\n\nThis is chunk ${chunkIndex + 1} of ${totalChunks}.`
    : ''

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${prompt}${chunkContext}\n\nTranscript:\n${chunk}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Check if quota exceeded
      if (errorText.includes('quota') || errorText.includes('limit')) {
        await markKeyQuotaExceeded(key)
        throw new Error(`API quota exceeded for key`)
      }

      // Check if invalid key
      if (errorText.includes('invalid') || errorText.includes('API key')) {
        await markKeyInvalid(key, 'Invalid API key during summarization')
        throw new Error(`Invalid API key`)
      }
      
      throw new Error(`Gemini API error: ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('No summary generated by Gemini API')
    }

    // Mark key as successful
    await markKeySuccess(key)

    const summary = result.candidates[0].content.parts[0].text
    return summary
  } catch (error: any) {
    // Improved fallback: retry up to MAX_RETRIES with exponential backoff and fresh key from pool
    if (retryCount < MAX_RETRIES) {
      console.warn(`summarizeChunk failed (attempt ${retryCount + 1}/${MAX_RETRIES}) for chunk ${chunkIndex + 1}/${totalChunks}: ${error?.message || error}`)
      await backoff(retryCount)
      return summarizeChunk(chunk, summaryType, chunkIndex, totalChunks, undefined, retryCount + 1)
    }
    throw error
  }
}

/**
 * Summarize text using Gemini API with chunking support and parallel processing
 * Automatically distributes chunks across available API keys
 */
export async function summarizeWithGemini(
  request: SummarizationRequest
): Promise<SummarizationResult> {
  const { text, summaryType } = request

  // Chunk the text
  const chunks = chunkText(text)
  console.log(`Chunked text into ${chunks.length} chunks`)

  // Adaptive parallelism based on input size (word count) and chunk count
  const wordCount = text.split(/\s+/).length
  let desiredParallelism = 3
  if (wordCount > 5000) desiredParallelism = 4
  if (wordCount > 15000) desiredParallelism = 6
  if (wordCount > 30000) desiredParallelism = 8
  if (wordCount > 60000) desiredParallelism = 10
  if (wordCount > 90000) desiredParallelism = 12
  // Never exceed number of chunks
  desiredParallelism = Math.min(desiredParallelism, chunks.length)

  // Get available API keys for parallel processing (request desiredParallelism)
  const availableKeys = await getKeysForParallelProcessing(desiredParallelism)
  console.log(`Requested ${desiredParallelism} keys, using ${availableKeys.length} for parallel processing`)

  // Distribute chunks across available keys (round-robin)
  const summaries = await Promise.all(
    chunks.map((chunk, index) => {
      const keyIndex = availableKeys.length > 0 ? index % availableKeys.length : 0
      const key = availableKeys[keyIndex]
      return summarizeChunk(chunk, summaryType, index, chunks.length, key)
    })
  )

  // Combine summaries
  let combinedLatex = summaries.join('\n\n')

  // If multiple chunks, do a final pass to combine them cohesively
  if (chunks.length > 1) {
    const combinePrompt = `Combine the following LaTeX sections into a cohesive, well-structured document.
Remove any redundancy and ensure smooth transitions between sections.
Maintain the LaTeX formatting (no \\documentclass or \\begin{document}).

Sections to combine:\n\n${combinedLatex}`

    // Use robust retry here too
    combinedLatex = await summarizeChunk(combinePrompt, summaryType, 0, 1, undefined, 0)
  }

  // Clean up the LaTeX (remove document preamble and markdown code blocks if present)
  combinedLatex = combinedLatex
    .replace(/```latex\s*/g, '')
    .replace(/```\s*$/g, '')
    .replace(/^'latex\s*/g, '')
    .replace(/\\documentclass.*?\n/g, '')
    .replace(/\\begin{document}/g, '')
    .replace(/\\end{document}/g, '')
    .trim()

  return {
    latexContent: combinedLatex,
    totalTokens: Math.floor(text.length / CHARS_PER_TOKEN),
    chunkCount: chunks.length,
  }
}

/**
 * Check if Gemini API is configured
 * Now checks both the key pool and fallback environment variable
 */
export async function isConfigured(): Promise<boolean> {
  const key = await getKeyForTextGeneration()
  return !!key
}

/**
 * Mock summarization for development/testing without API key
 */
export async function mockSummarization(
  request: SummarizationRequest
): Promise<SummarizationResult> {
  const { text, summaryType } = request

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000))

  const wordCount = text.split(/\s+/).length
  const mockLatex = `\\section{Mock Summary (${summaryType})}

This is a mock LaTeX summary of the transcribed lecture content. In production, this would be generated by the Gemini API based on the transcript.

\\subsection{Key Concepts}

\\begin{itemize}
  \\item Main topic 1 from the lecture
  \\item Important concept 2 discussed
  \\item Critical point 3 emphasized
\\end{itemize}

\\subsection{Detailed Explanation}

The lecture covered approximately ${wordCount} words of content. The ${summaryType} summary type was requested, which would ${
    summaryType === 'compact' ? 'condense the information to essentials' :
    summaryType === 'detailed' ? 'preserve most important details' :
    'expand on the concepts with additional context'
  }.

\\subsection{Mathematical Content}

Example equation from the lecture:
\\begin{equation}
  E = mc^2
\\end{equation}

\\subsection{Conclusion}

This mock summary demonstrates the LaTeX output format that would be generated for the lecture content.`

  return {
    latexContent: mockLatex,
    totalTokens: Math.floor(text.length / CHARS_PER_TOKEN),
    chunkCount: 1,
  }
}
