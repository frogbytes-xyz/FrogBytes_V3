'use client'

import toast from 'react-hot-toast'

type ToastVariant = 'default' | 'destructive' | 'success'

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
}

export function useToast() {
  return {
    toast: ({ title, description, variant = 'default' }: ToastOptions) => {
      const message = `${title}${description ? ` - ${description}` : ''}`

      switch (variant) {
        case 'destructive':
          return toast.error(message)
        case 'success':
          return toast.success(message)
        default:
          return toast(message)
      }
    }
  }
}

// Export direct toast function for backwards compatibility
export { toast }
