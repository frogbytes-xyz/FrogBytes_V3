/**
 * Document similarity and recommendation algorithms
 */

import type { EnhancedSummary } from '@/lib/types/library'

export interface SimilarityScore {
  documentId: string
  score: number
  factors: {
    university: number
    subject: number
    courseCode: number
    tags: number
    keywords: number
    professor: number
    contentSimilarity: number
  }
}

export interface RecommendationOptions {
  maxResults?: number
  minScore?: number
  includeFactors?: boolean
  weightings?: SimilarityWeightings
}

export interface SimilarityWeightings {
  university: number
  subject: number
  courseCode: number
  tags: number
  keywords: number
  professor: number
  contentSimilarity: number
}

export const defaultWeightings: SimilarityWeightings = {
  university: 0.15,
  subject: 0.25,
  courseCode: 0.2,
  tags: 0.15,
  keywords: 0.1,
  professor: 0.1,
  contentSimilarity: 0.05
}

/**
 * Calculate similarity between two documents
 */
export function calculateSimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary,
  weightings: SimilarityWeightings = defaultWeightings
): SimilarityScore {
  const factors = {
    university: calculateUniversitySimilarity(doc1, doc2),
    subject: calculateSubjectSimilarity(doc1, doc2),
    courseCode: calculateCourseCodeSimilarity(doc1, doc2),
    tags: calculateTagsSimilarity(doc1, doc2),
    keywords: calculateKeywordsSimilarity(doc1, doc2),
    professor: calculateProfessorSimilarity(doc1, doc2),
    contentSimilarity: calculateContentSimilarity(doc1, doc2)
  }

  const score = Object.entries(factors).reduce((total, [key, value]) => {
    return total + value * weightings[key as keyof SimilarityWeightings]
  }, 0)

  return {
    documentId: doc2.id,
    score: Math.round(score * 100) / 100, // Round to 2 decimal places
    factors
  }
}

/**
 * Get recommendations for a user based on their uploaded documents
 */
export function getRecommendationsForUser(
  userDocuments: EnhancedSummary[],
  allDocuments: EnhancedSummary[],
  options: RecommendationOptions = {}
): SimilarityScore[] {
  const {
    maxResults = 10,
    minScore = 0.3,
    weightings = defaultWeightings
  } = options

  if (userDocuments.length === 0) {
    // If user has no documents, return popular documents
    return allDocuments
      .filter(doc => doc.reputation_score > 0)
      .sort((a, b) => b.reputation_score - a.reputation_score)
      .slice(0, maxResults)
      .map(doc => ({
        documentId: doc.id,
        score: Math.min(0.5, doc.reputation_score / 10), // Normalize reputation score
        factors: {
          university: 0,
          subject: 0,
          courseCode: 0,
          tags: 0,
          keywords: 0,
          professor: 0,
          contentSimilarity: Math.min(0.5, doc.reputation_score / 10)
        }
      }))
  }

  const userDocumentIds = new Set(userDocuments.map(doc => doc.id))
  const candidateDocuments = allDocuments.filter(
    doc => !userDocumentIds.has(doc.id)
  )

  const similarities = new Map<string, SimilarityScore[]>()

  // Calculate similarity for each user document against all candidates
  for (const userDoc of userDocuments) {
    const docSimilarities = candidateDocuments.map(candidateDoc =>
      calculateSimilarity(userDoc, candidateDoc, weightings)
    )
    similarities.set(userDoc.id, docSimilarities)
  }

  // Aggregate similarities and rank recommendations
  const aggregatedScores = new Map<string, number>()
  const aggregatedFactors = new Map<string, SimilarityScore['factors']>()

  for (const [_userDocId, docSimilarities] of similarities) {
    for (const similarity of docSimilarities) {
      const currentScore = aggregatedScores.get(similarity.documentId) || 0
      // (no-op) existing aggregated factors are read from the map when needed

      // Use maximum similarity score across user documents
      if (similarity.score > currentScore) {
        aggregatedScores.set(similarity.documentId, similarity.score)
        aggregatedFactors.set(similarity.documentId, similarity.factors)
      }
    }
  }

  // Convert to results and sort
  const recommendations = Array.from(aggregatedScores.entries())
    .map(([documentId, score]) => ({
      documentId,
      score,
      factors: aggregatedFactors.get(documentId)!
    }))
    .filter(rec => rec.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  return recommendations
}

// Individual similarity calculation functions

function calculateUniversitySimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary
): number {
  if (!doc1.university || !doc2.university) return 0
  return doc1.university.toLowerCase() === doc2.university.toLowerCase() ? 1 : 0
}

function calculateSubjectSimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary
): number {
  if (!doc1.subject || !doc2.subject) return 0

  const subject1 = doc1.subject.toLowerCase()
  const subject2 = doc2.subject.toLowerCase()

  if (subject1 === subject2) return 1

  // Check for partial matches (e.g., "Computer Science" vs "CS")
  if (subject1.includes(subject2) || subject2.includes(subject1)) {
    return 0.7
  }

  return 0
}

function calculateCourseCodeSimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary
): number {
  if (!doc1.course_code || !doc2.course_code) return 0

  const code1 = doc1.course_code.toLowerCase().replace(/\s+/g, '')
  const code2 = doc2.course_code.toLowerCase().replace(/\s+/g, '')

  if (code1 === code2) return 1

  // Check for similar course prefixes (e.g., CS101 vs CS102)
  const prefix1 = code1.match(/^[a-z]+/)?.[0]
  const prefix2 = code2.match(/^[a-z]+/)?.[0]

  if (prefix1 && prefix2 && prefix1 === prefix2) {
    return 0.5
  }

  return 0
}

function calculateTagsSimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary
): number {
  const tags1 = doc1.tags || []
  const tags2 = doc2.tags || []

  if (tags1.length === 0 || tags2.length === 0) return 0

  const tags1Lower = tags1.map(tag => tag.toLowerCase())
  const tags2Lower = tags2.map(tag => tag.toLowerCase())

  const intersection = tags1Lower.filter(tag => tags2Lower.includes(tag))
  const union = new Set([...tags1Lower, ...tags2Lower])

  return intersection.length / union.size // Jaccard similarity
}

function calculateKeywordsSimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary
): number {
  const keywords1 = doc1.keywords || []
  const keywords2 = doc2.keywords || []

  if (keywords1.length === 0 || keywords2.length === 0) return 0

  const keywords1Lower = keywords1.map(kw => kw.toLowerCase())
  const keywords2Lower = keywords2.map(kw => kw.toLowerCase())

  const intersection = keywords1Lower.filter(kw => keywords2Lower.includes(kw))
  const union = new Set([...keywords1Lower, ...keywords2Lower])

  return intersection.length / union.size // Jaccard similarity
}

function calculateProfessorSimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary
): number {
  if (!doc1.professor || !doc2.professor) return 0
  return doc1.professor.toLowerCase() === doc2.professor.toLowerCase() ? 1 : 0
}

function calculateContentSimilarity(
  doc1: EnhancedSummary,
  doc2: EnhancedSummary
): number {
  // Basic content similarity based on title and lecture name
  const content1 = [doc1.title, doc1.lecture_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const content2 = [doc2.title, doc2.lecture_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!content1 || !content2) return 0

  const words1 = content1.split(/\s+/)
  const words2 = content2.split(/\s+/)

  const intersection = words1.filter(word => words2.includes(word))
  const union = new Set([...words1, ...words2])

  return intersection.length / union.size // Jaccard similarity
}

/**
 * Enhanced search function with improved filtering and ranking
 */
export function enhancedSearch(
  documents: EnhancedSummary[],
  query: string,
  filters: {
    university?: string
    subject?: string
    courseCode?: string
    tags?: string[]
    minReputation?: number
    documentType?: string
    fileCategory?: string
    difficultyLevel?: string
    professor?: string
  } = {}
): EnhancedSummary[] {
  let filteredDocs = documents

  // Apply filters
  if (filters.university) {
    filteredDocs = filteredDocs.filter(doc =>
      doc.university?.toLowerCase().includes(filters.university!.toLowerCase())
    )
  }

  if (filters.subject) {
    filteredDocs = filteredDocs.filter(doc =>
      doc.subject?.toLowerCase().includes(filters.subject!.toLowerCase())
    )
  }

  if (filters.courseCode) {
    filteredDocs = filteredDocs.filter(doc =>
      doc.course_code?.toLowerCase().includes(filters.courseCode!.toLowerCase())
    )
  }

  if (filters.tags && filters.tags.length > 0) {
    filteredDocs = filteredDocs.filter(doc =>
      doc.tags?.some(tag =>
        filters.tags!.some(filterTag =>
          tag.toLowerCase().includes(filterTag.toLowerCase())
        )
      )
    )
  }

  if (filters.minReputation !== undefined) {
    filteredDocs = filteredDocs.filter(
      doc => doc.reputation_score >= filters.minReputation!
    )
  }

  if (filters.documentType) {
    filteredDocs = filteredDocs.filter(
      doc => doc.document_type === filters.documentType
    )
  }

  if (filters.fileCategory) {
    filteredDocs = filteredDocs.filter(
      doc => doc.file_category === filters.fileCategory
    )
  }

  if (filters.difficultyLevel) {
    filteredDocs = filteredDocs.filter(
      doc => doc.difficulty_level === filters.difficultyLevel
    )
  }

  if (filters.professor) {
    filteredDocs = filteredDocs.filter(doc =>
      doc.professor?.toLowerCase().includes(filters.professor!.toLowerCase())
    )
  }

  // Apply search query if provided
  if (query.trim()) {
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/)

    filteredDocs = filteredDocs
      .map(doc => ({
        doc,
        score: calculateSearchScore(doc, queryWords)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.doc)
  } else {
    // Sort by reputation if no search query
    filteredDocs = filteredDocs.sort(
      (a, b) => b.reputation_score - a.reputation_score
    )
  }

  return filteredDocs
}

function calculateSearchScore(
  doc: EnhancedSummary,
  queryWords: string[]
): number {
  let score = 0

  const searchableContent = [
    doc.title,
    doc.lecture_name,
    doc.subject,
    doc.course_code,
    doc.course_name,
    doc.professor,
    ...(doc.tags || []),
    ...(doc.keywords || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  // Exact phrase match gets highest score
  const fullQuery = queryWords.join(' ')
  if (searchableContent.includes(fullQuery)) {
    score += 100
  }

  // Individual word matches
  for (const word of queryWords) {
    if (searchableContent.includes(word)) {
      score += 10
    }
  }

  // Title and lecture name matches get bonus points
  const titleContent = [doc.title, doc.lecture_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  for (const word of queryWords) {
    if (titleContent.includes(word)) {
      score += 20
    }
  }

  // Course code exact match gets high score
  if (
    doc.course_code &&
    queryWords.some(word => doc.course_code!.toLowerCase().includes(word))
  ) {
    score += 50
  }

  return score
}
