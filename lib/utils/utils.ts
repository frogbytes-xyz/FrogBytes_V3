import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge CSS classes using clsx and tailwind-merge
 *
 * This function combines the functionality of clsx for conditional class names
 * with tailwind-merge to handle Tailwind CSS class conflicts intelligently.
 * It ensures that only the last conflicting class is applied, preventing
 * style conflicts in Tailwind CSS.
 *
 * @param inputs - Variable number of class values (strings, objects, arrays, etc.)
 * @returns Merged and deduplicated class string
 *
 * @example
 * ```tsx
 * // Basic usage
 * cn('px-4 py-2', 'bg-blue-500')
 * // Result: 'px-4 py-2 bg-blue-500'
 *
 * // Conditional classes
 * cn('base-class', { 'active-class': isActive, 'disabled-class': isDisabled })
 *
 * // Tailwind conflict resolution
 * cn('px-4', 'px-6') // Result: 'px-6' (last one wins)
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
