import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createCollectionService } from '@/lib/services/collection-service'
import Menubar from '@/components/layout/Menubar'
import DraggableSummaryCardClientWrapper from '@/components/DraggableSummaryCardClientWrapper'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function CollectionGuestPage({ params }: PageProps) {
  const { slug } = await params
  if (!slug || typeof slug !== 'string') return notFound()

  const service = await createCollectionService()
  const shared = await service.getSharedCollection(slug)
  if (!shared) return notFound()

  const returnUrl = `/dashboard?importCollection=${encodeURIComponent(slug)}`

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Menubar />

      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8 pt-24">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{shared.name}</h1>
          {shared.description && <p className="text-muted-foreground">{shared.description}</p>}
          <p className="text-sm text-muted-foreground mt-2">This collection has {shared.summaries?.length || 0} public summaries.</p>
        </div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pointer-events-none">
            {shared.summaries?.map((s: any) => (
              <DraggableSummaryCardClientWrapper key={s.id} summary={s} />
            ))}
          </div>

          {/* CTA overlay for guests */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-background/90 border rounded-lg p-6 text-center shadow-sm max-w-md mx-4">
              <h2 className="text-xl font-semibold mb-2">Create an account to import this collection</h2>
              <p className="text-sm text-muted-foreground mb-4">Log in or register to add this collection to your dashboard and access the documents.</p>
              <div className="flex gap-3 justify-center">
                <Button asChild>
                  <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}>
                    Log in
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`}>
                    Register
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
