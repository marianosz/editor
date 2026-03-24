import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isDevelopment =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'development'

export const isProduction =
  process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'

export const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'

const APP_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '')

export function withBasePath(path: string): string {
  if (!path || !APP_BASE_PATH) return path

  if (
    /^(https?:)?\/\//.test(path) ||
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith(APP_BASE_PATH)
  ) {
    return path
  }

  if (path.startsWith('/')) {
    return `${APP_BASE_PATH}${path}`
  }

  return path
}

/**
 * Base URL for the application
 * Uses NEXT_PUBLIC_* variables which are available at build time
 */
export const BASE_URL = (() => {
  // Development: localhost
  if (isDevelopment) {
    return process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
  }

  // Preview deployments: use Vercel branch URL
  if (isPreview && process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  // Production: use custom domain or Vercel production URL
  if (isProduction) {
    return (
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://editor.pascal.app')
    )
  }

  // Fallback (should never reach here in normal operation)
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
})()
