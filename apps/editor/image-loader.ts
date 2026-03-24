import type { ImageLoaderProps } from 'next/image'

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const normalizedBasePath =
  configuredBasePath && configuredBasePath !== '/'
    ? configuredBasePath.startsWith('/')
      ? configuredBasePath
      : `/${configuredBasePath}`
    : ''

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  let resolvedSrc = src

  if (normalizedBasePath && src.startsWith('/') && !src.startsWith(`${normalizedBasePath}/`)) {
    resolvedSrc = `${normalizedBasePath}${src}`
  }

  const params = new URLSearchParams({
    url: resolvedSrc,
    w: String(width),
    q: String(quality ?? 75),
  })

  return `${normalizedBasePath}/_next/image?${params.toString()}`
}
