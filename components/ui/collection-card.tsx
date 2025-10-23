import { useCallback, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Folder,
  Users,
  Lock,
  MoreHorizontal,
  Share,
  Trash2,
  Edit3,
  Eye
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Collection {
  id: string
  name: string
  description: string | null
  is_public: boolean
  share_slug: string | null
  created_at: string
  updated_at: string
  itemCount?: number
}

interface CollectionCardProps {
  collection: Collection
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleVisibility: () => void
  isLoading: boolean
}

interface CollectionMenuProps {
  collection: Collection
  onEdit: () => void
  onDelete: () => void
  onToggleVisibility: () => void
  isLoading: boolean
}

function CollectionMenu({
  collection,
  onEdit,
  onDelete,
  onToggleVisibility,
  isLoading
}: CollectionMenuProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <Dialog open={showMenu} onOpenChange={setShowMenu}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{collection.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              onEdit()
              setShowMenu(false)
            }}
            disabled={isLoading}
          >
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Collection
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              onToggleVisibility()
              setShowMenu(false)
            }}
            disabled={isLoading}
          >
            {collection.is_public ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Make Private
              </>
            ) : (
              <>
                <Share className="w-4 h-4 mr-2" />
                Share Collection
              </>
            )}
          </Button>
          {collection.is_public && collection.share_slug && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                const shareUrl = `${window.location.origin}/collections/${collection.share_slug}`
                navigator.clipboard.writeText(shareUrl)
                toast.success('Share link copied to clipboard!')
                setShowMenu(false)
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Copy Share Link
            </Button>
          )}
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={() => {
              onDelete()
              setShowMenu(false)
            }}
            disabled={isLoading}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Collection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function CollectionCard({
  collection,
  onClick,
  onEdit,
  onDelete,
  onToggleVisibility,
  isLoading
}: CollectionCardProps) {
  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // Don&apos;t trigger click if clicking on the menu button
      if ((e.target as Element).closest('[data-menu-trigger]')) {
        return
      }
      onClick()
    },
    [onClick]
  )

  return (
    <Card
      className="transition-all cursor-pointer hover:shadow-md"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Folder className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm line-clamp-1">
                {collection.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(collection.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div data-menu-trigger>
            <CollectionMenu
              collection={collection}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
              isLoading={isLoading}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {collection.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {collection.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={collection.is_public ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {collection.is_public ? (
                <>
                  <Users className="w-3 h-3 mr-1" />
                  Shared
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Private
                </>
              )}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {collection.itemCount || 0} items
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
