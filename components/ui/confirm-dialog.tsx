'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2, Archive } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'warning' | 'default'
  icon?: 'delete' | 'archive' | 'warning'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon = 'warning'
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const IconComponent = {
    delete: Trash2,
    archive: Archive,
    warning: AlertTriangle
  }[icon]

  const iconColor = {
    destructive: 'text-red-500',
    warning: 'text-orange-500',
    default: 'text-blue-500'
  }[variant]

  const iconBg = {
    destructive: 'bg-red-100 dark:bg-red-900/20',
    warning: 'bg-orange-100 dark:bg-orange-900/20',
    default: 'bg-blue-100 dark:bg-blue-900/20'
  }[variant]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={`rounded-full p-3 ${iconBg}`}>
              <IconComponent className={`h-6 w-6 ${iconColor}`} />
            </div>
            <div className="flex-1 space-y-2">
              <DialogTitle className="text-left">{title}</DialogTitle>
              <DialogDescription className="text-left">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:mr-2"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            className={
              variant === 'warning'
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : ''
            }
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
