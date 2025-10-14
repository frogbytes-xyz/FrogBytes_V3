'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface LoginPromptDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginPromptDialog({ isOpen, onClose }: LoginPromptDialogProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-8 pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Sign in required
            </h2>
            <p className="text-muted-foreground">
              Please sign in to access your dashboard and upload files. It's free to get started!
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                onClose()
                router.push('/login')
              }}
              size="lg"
              className="w-full"
            >
              Sign in
            </Button>
            <Button
              onClick={() => {
                onClose()
                router.push('/register')
              }}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Create account
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}


