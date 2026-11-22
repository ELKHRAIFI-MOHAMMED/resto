import { useState, type ImgHTMLAttributes } from 'react'

import { cx } from '@/lib/cx'

interface ProductImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null
  alt: string
}

/**
 * Product photo with a designed fallback (an eight-point zellige star) for
 * dishes that have no photo yet or whose image fails to load.
 */
export function ProductImage({
  src,
  alt,
  className,
  loading = 'lazy',
  ...props
}: ProductImageProps) {
  // Remember which URL failed, so a new src (e.g. after an admin update) is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      <div
        // A decorative image (alt="") stays decorative: hidden, not an unnamed img.
        {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
        className={cx('flex items-center justify-center bg-surface', className)}
      >
        <ZelligeStar className="h-1/3 max-h-16 w-1/3 max-w-16 text-border" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cx('bg-surface object-cover', className)}
      {...props}
    />
  )
}

export function ZelligeStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className} fill="none">
      <g stroke="currentColor" strokeWidth="3">
        <rect x="20" y="20" width="60" height="60" />
        <rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r="12" />
      </g>
    </svg>
  )
}
