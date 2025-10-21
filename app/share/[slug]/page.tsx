import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { createDocumentSharingService } from '@/lib/services/document-sharing-service'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * Shared Document Page
 * Displays a publicly shared document with authentication requirement
 */
export default async function SharedDocumentPage({ params }: PageProps): Promise<JSX.Element> {
  const { slug } = await params

  if (!slug || typeof slug !== 'string') {
    notFound()
  }

  // Resolve slug to summary ID and redirect to learn page
  const sharingService = await createDocumentSharingService()
  const shared = await sharingService.getSharedDocument(slug)

  if (!shared) {
    notFound()
  }

  // Redirect to /learn/<id>. We include a flag so the learn page can show CTA overlay for guests.
  redirect(`/learn/${shared!.id}?shared=1`)
}

/**
 * Generate metadata for shared documents (SEO)
 */
export async function generateMetadata({ params }: PageProps) {
import { logger } from '@/lib/utils/logger'
  const { slug } = await params

  try {
    const sharingService = await createDocumentSharingService()
    const sharedDocument = await sharingService.getSharedDocument(slug)

    if (!sharedDocument) {
      return {
        title: 'Document Not Found | FrogBytes',
        description: 'The shared document you are looking for could not be found.'
      }
    }

    return {
      title: `${sharedDocument.title} | Shared on FrogBytes`,
      description: `View "${sharedDocument.title}" shared by ${sharedDocument.ownerEmail} on FrogBytes - AI-powered learning platform.`,
      openGraph: {
        title: sharedDocument.title,
        description: `A document shared on FrogBytes by ${sharedDocument.ownerEmail}`,
        type: 'article',
        publishedTime: sharedDocument.createdAt,
        authors: [sharedDocument.ownerEmail]
      },
      twitter: {
        card: 'summary',
        title: sharedDocument.title,
        description: `A document shared on FrogBytes by ${sharedDocument.ownerEmail}`
      }
    }
  } catch (error) {
    logger.error('Error generating metadata for shared document', error)
    return {
      title: 'Shared Document | FrogBytes',
      description: 'View shared documents on FrogBytes - AI-powered learning platform.'
    }
  }
}