import { redirect, notFound } from 'next/navigation'
import { createCollectionService } from '@/lib/services/collection-service'

/**
 * Collection Share Page
 * Resolves a share slug and redirects to the collection detail page
 * Works similar to the shared document architecture
 */
export default async function CollectionSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || typeof slug !== 'string') return notFound()

  // Resolve shared collection to get the collection ID
  const service = await createCollectionService()
  const shared = await service.getSharedCollection(slug)
  if (!shared) return notFound()

  // Redirect to the collection detail page with a shared flag
  // This allows the detail page to show the same interface for both auth and guest users
  redirect(`/dashboard/collections/${shared.id}?shared=1`)
}

/**
 * Generate metadata for shared collections (SEO)
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
import { logger } from '@/lib/utils/logger'
  const { slug } = await params

  try {
    const service = await createCollectionService()
    const sharedCollection = await service.getSharedCollection(slug)

    if (!sharedCollection) {
      return {
        title: 'Collection Not Found | FrogBytes',
        description: 'The shared collection you are looking for could not be found.'
      }
    }

    const summaryCount = sharedCollection.summaries?.length || 0

    return {
      title: `${sharedCollection.name} | Shared Collection on FrogBytes`,
      description: sharedCollection.description || `View "${sharedCollection.name}" - a collection with ${summaryCount} summaries shared on FrogBytes - AI-powered learning platform.`,
      openGraph: {
        title: sharedCollection.name,
        description: sharedCollection.description || `A collection with ${summaryCount} summaries shared on FrogBytes`,
        type: 'article',
      },
      twitter: {
        card: 'summary',
        title: sharedCollection.name,
        description: sharedCollection.description || `A collection with ${summaryCount} summaries shared on FrogBytes`
      }
    }
  } catch (error) {
    logger.error('Error generating metadata for shared collection', error)
    return {
      title: 'Shared Collection | FrogBytes',
      description: 'View shared collections on FrogBytes - AI-powered learning platform.'
    }
  }
}
