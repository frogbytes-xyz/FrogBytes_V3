/**
 * AI-Powered LaTeX Content Deduplication Utility
 * Uses AI to intelligently identify and remove duplicate content
 */

import { logger } from '@/lib/utils/logger'
import { getKeyForTextGeneration } from '@/lib/api-keys/key-pool-service'

export interface DeduplicationOptions {
  useAI: boolean
  aggressiveMode: boolean
  preserveStructure: boolean
}

const DEFAULT_OPTIONS: DeduplicationOptions = {
  useAI: true,
  aggressiveMode: false,
  preserveStructure: true
}

/**
 * AI-powered deduplication prompt
 */
const DEDUPLICATION_PROMPT = `You are an expert academic editor. Your task is to remove duplicate and redundant content from this LaTeX document while preserving ALL unique information.

**TASK:**
Remove duplicates, redundant explanations, and repetitive content from the LaTeX document below.

**RULES:**
- Preserve ALL unique information, examples, and details
- Remove only true duplicates and redundant explanations
- Maintain logical document structure
- Keep all important concepts, definitions, and examples
- Merge similar content only if it's truly redundant
- Preserve LaTeX formatting and structure

**WHAT TO REMOVE:**
- Identical sentences or paragraphs
- Redundant explanations of the same concept
- Repeated examples of the same principle
- Duplicate definitions or explanations
- Unnecessary repetition of key points

**WHAT TO KEEP:**
- All unique information
- Different examples of the same concept
- Important details and context
- All mathematical content
- All code examples
- All references and citations

**OUTPUT:**
Return the cleaned LaTeX content with duplicates removed. Do not add any explanations or comments.

LATEX DOCUMENT:
{content}

CLEANED LATEX:`

/**
 * Aggressive AI-powered deduplication prompt
 */
const AGGRESSIVE_DEDUPLICATION_PROMPT = `You are an expert academic editor specializing in content optimization. Your task is to aggressively remove duplicate and redundant content from this LaTeX document while preserving ALL unique information.

**TASK:**
Aggressively remove duplicates, redundant explanations, and repetitive content from the LaTeX document below.

**RULES:**
- Preserve ALL unique information, examples, and details
- Remove duplicates, redundant explanations, and repetitive content
- Maintain logical document structure
- Keep all important concepts, definitions, and examples
- Merge similar content even if slightly different
- Preserve LaTeX formatting and structure
- Be more aggressive in removing redundancy

**WHAT TO REMOVE:**
- Identical sentences or paragraphs
- Redundant explanations of the same concept
- Repeated examples of the same principle
- Duplicate definitions or explanations
- Unnecessary repetition of key points
- Similar content that conveys the same information
- Redundant explanations of similar concepts

**WHAT TO KEEP:**
- All unique information
- Different examples of the same concept
- Important details and context
- All mathematical content
- All code examples
- All references and citations

**OUTPUT:**
Return the cleaned LaTeX content with duplicates removed. Do not add any explanations or comments.

LATEX DOCUMENT:
{content}

CLEANED LATEX:`

/**
 * Clean and deduplicate LaTeX content using AI
 */
export async function deduplicateLatexContent(
  content: string,
  options: Partial<DeduplicationOptions> = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  logger.info('[AI Deduplication] Starting AI-powered content cleanup')

  try {
    if (!opts.useAI) {
      // Fallback to basic cleanup
      return basicCleanup(content)
    }

    // Use AI for intelligent deduplication
    const cleanedContent = await aiDeduplication(content, opts)

    logger.info('[AI Deduplication] Content cleanup completed')
    return cleanedContent
  } catch (error) {
    logger.error('[AI Deduplication] Error during cleanup:', error)
    logger.info('[AI Deduplication] Falling back to basic cleanup')
    return basicCleanup(content)
  }
}

/**
 * AI-powered deduplication using Gemini API
 */
async function aiDeduplication(
  content: string,
  options: DeduplicationOptions
): Promise<string> {
  const apiKey = await getKeyForTextGeneration()

  if (!apiKey) {
    throw new Error('No API key available for AI deduplication')
  }

  // Choose prompt based on aggressive mode
  const basePrompt = options.aggressiveMode
    ? AGGRESSIVE_DEDUPLICATION_PROMPT
    : DEDUPLICATION_PROMPT

  const prompt = basePrompt.replace('{content}', content)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3, // Low temperature for consistent results
          maxOutputTokens: 16000
        }
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `AI deduplication failed: ${response.statusText} - ${errorText}`
    )
  }

  const result = await response.json()

  if (!result.candidates || result.candidates.length === 0) {
    throw new Error('AI deduplication failed: No response generated')
  }

  const cleanedContent = result.candidates[0].content.parts[0].text

  // Clean up any potential formatting issues
  return cleanLatexFormatting(cleanedContent)
}

/**
 * Basic cleanup fallback (algorithmic approach)
 */
function basicCleanup(content: string): string {
  logger.info('[Deduplication] Using basic algorithmic cleanup')

  let cleanedContent = content

  // Remove duplicate sentences within paragraphs
  cleanedContent = removeDuplicateSentences(cleanedContent)

  // Remove duplicate paragraphs
  cleanedContent = removeDuplicateParagraphs(cleanedContent)

  // Clean up LaTeX formatting
  cleanedContent = cleanLatexFormatting(cleanedContent)

  return cleanedContent
}

/**
 * Remove duplicate sentences within the same paragraph
 */
function removeDuplicateSentences(content: string): string {
  const paragraphs = content.split('\n\n')

  return paragraphs
    .map(paragraph => {
      if (paragraph.trim().length === 0) return paragraph

      // Split into sentences (simple approach)
      const sentences = paragraph
        .split(/[.!?]+/)
        .filter(s => s.trim().length > 0)
      const uniqueSentences: string[] = []

      for (const sentence of sentences) {
        const trimmed = sentence.trim()
        if (trimmed.length === 0) continue

        // Check if this sentence is similar to any existing one
        const isDuplicate = uniqueSentences.some(
          existing => calculateSimilarity(trimmed, existing) > 0.8
        )

        if (!isDuplicate) {
          uniqueSentences.push(trimmed)
        }
      }

      return uniqueSentences.join('. ').replace(/\.\s*$/, '') + '.'
    })
    .join('\n\n')
}

/**
 * Remove duplicate paragraphs
 */
function removeDuplicateParagraphs(content: string): string {
  const paragraphs = content.split('\n\n')
  const uniqueParagraphs: string[] = []

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      uniqueParagraphs.push(paragraph)
      continue
    }

    // Check if this paragraph is similar to any existing one
    const isDuplicate = uniqueParagraphs.some(
      existing =>
        existing.trim().length > 0 &&
        calculateSimilarity(paragraph.trim(), existing.trim()) > 0.7
    )

    if (!isDuplicate) {
      uniqueParagraphs.push(paragraph)
    }
  }

  return uniqueParagraphs.join('\n\n')
}

/**
 * Merge similar content blocks
 */
function mergeSimilarContent(content: string, threshold: number): string {
  // This is a simplified implementation
  // In practice, you might want more sophisticated merging logic

  const sections = content.split(/(?=\\section\{)/)

  if (sections.length <= 1) return content

  const mergedSections: string[] = []

  for (let i = 0; i < sections.length; i++) {
    const currentSection = sections[i].trim()
    if (currentSection.length === 0) continue

    // Check if this section should be merged with the previous one
    if (mergedSections.length > 0) {
      const lastSection = mergedSections[mergedSections.length - 1]
      const similarity = calculateSimilarity(currentSection, lastSection)

      if (similarity > threshold) {
        // Merge sections
        mergedSections[mergedSections.length - 1] = mergeSections(
          lastSection,
          currentSection
        )
        continue
      }
    }

    mergedSections.push(currentSection)
  }

  return mergedSections.join('\n\n')
}

/**
 * Remove duplicate sections (conservative approach)
 */
function removeDuplicateSections(content: string): string {
  const sections = content.split(/(?=\\section\{)/)
  const uniqueSections: string[] = []
  const sectionTitles = new Set<string>()

  for (const section of sections) {
    if (section.trim().length === 0) continue

    // Extract section title
    const titleMatch = section.match(/\\section\{([^}]+)\}/)
    const title = titleMatch ? titleMatch[1].toLowerCase().trim() : ''

    if (title && sectionTitles.has(title)) {
      // Skip duplicate section titles
      continue
    }

    if (title) {
      sectionTitles.add(title)
    }

    uniqueSections.push(section)
  }

  return uniqueSections.join('\n\n')
}

/**
 * Clean up LaTeX formatting issues
 */
function cleanLatexFormatting(content: string): string {
  return (
    content
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      // Fix common LaTeX issues
      .replace(/\\\s*\n/g, '\\\\\n')
      // Remove empty sections
      .replace(/\\section\{[^}]*\}\s*\n\s*$/gm, '')
      // Clean up multiple spaces
      .replace(/[ \t]+/g, ' ')
      // Remove trailing whitespace
      .replace(/[ \t]+$/gm, '')
      .trim()
  )
}

/**
 * Merge two sections intelligently
 */
function mergeSections(section1: string, section2: string): string {
  // Simple merging strategy - in practice, you might want more sophisticated logic
  const title1 = section1.match(/\\section\{([^}]+)\}/)?.[1] || 'Merged Section'

  // Extract content from both sections (everything after the title)
  const content1 = section1.replace(/\\section\{[^}]+\}\s*/, '').trim()
  const content2 = section2.replace(/\\section\{[^}]+\}\s*/, '').trim()

  return `\\section{${title1}}\n\n${content1}\n\n${content2}`
}

/**
 * Calculate similarity between two strings using Jaccard similarity
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0
  if (str1.length === 0 || str2.length === 0) return 0.0

  // Normalize strings
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const s1 = normalize(str1)
  const s2 = normalize(str2)

  // Create word sets
  const words1 = new Set(s1.split(' '))
  const words2 = new Set(s2.split(' '))

  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Comprehensive content analysis for debugging and quality assessment
 */
export function analyzeContent(content: string): {
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  sectionCount: number
  estimatedDuplicates: number
  duplicatePercentage: number
  qualityScore: number
  latexElements: number
  mathContent: number
  averageWordsPerSentence: number
  averageSentencesPerParagraph: number
} {
  const words = content.split(/\s+/).filter(w => w.length > 0)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0)
  const sections = (content.match(/\\section\{/g) || []).length

  // Count LaTeX elements
  const latexElements = (content.match(/\\[a-zA-Z]+/g) || []).length
  const mathContent =
    (content.match(/\$[^$]+\$/g) || []).length +
    (content.match(/\\begin\{equation\}/g) || []).length

  // Estimate duplicates (simplified)
  const wordsSet = new Set(words.map(w => w.toLowerCase()))
  const estimatedDuplicates = words.length - wordsSet.size
  const duplicatePercentage =
    words.length > 0 ? (estimatedDuplicates / words.length) * 100 : 0

  // Quality score (0-100, higher is better)
  const qualityScore = Math.max(0, 100 - duplicatePercentage)

  // Calculate averages
  const averageWordsPerSentence =
    sentences.length > 0 ? words.length / sentences.length : 0
  const averageSentencesPerParagraph =
    paragraphs.length > 0 ? sentences.length / paragraphs.length : 0

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    sectionCount: sections,
    estimatedDuplicates,
    duplicatePercentage: Math.round(duplicatePercentage * 100) / 100,
    qualityScore: Math.round(qualityScore * 100) / 100,
    latexElements,
    mathContent,
    averageWordsPerSentence: Math.round(averageWordsPerSentence * 100) / 100,
    averageSentencesPerParagraph:
      Math.round(averageSentencesPerParagraph * 100) / 100
  }
}
