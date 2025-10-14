import { z } from 'zod'

/**
 * Common validation schemas
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format')

// Email validation
export const emailSchema = z.string().email('Invalid email format')

// Password validation (strong password requirements)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  )

// Username validation
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  )

// File upload validation
export const fileUploadSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  type: z.string().refine(
    (type) => ['application/pdf', 'image/png', 'image/jpeg'].includes(type),
    'File type must be PDF, PNG, or JPEG'
  )
})

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
})

// Search validation
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(200),
  filters: z.record(z.string()).optional()
})

/**
 * User-related validation schemas
 */

export const userCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  fullName: z.string().min(1, 'Full name is required').max(100)
})

export const userUpdateSchema = z.object({
  username: usernameSchema.optional(),
  fullName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional()
})

export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
})

/**
 * Content validation schemas
 */

export const contentCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  isPublic: z.boolean().default(false)
})

export const contentUpdateSchema = contentCreateSchema.partial()

/**
 * Utility functions for validation
 */

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    throw new Error(
      `Validation failed for ${firstError?.path?.join('.')}: ${firstError?.message}`
    )
  }

  return result.data
}

export function isValidUUID(value: string): boolean {
  return uuidSchema.safeParse(value).success
}

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success
}

/**
 * Sanitization helpers
 */

export function sanitizeHtml(input: string): string {
  // In a real app, you'd use a library like DOMPurify
  // This is a basic implementation for demonstration
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255)
}

export type {
  z as ZodType
}

export {
  z
}