import { cx } from '@/lib/cx'

import { ProductImage } from './ProductImage'

interface ArchImageProps {
  src: string | null
  alt: string
  priority?: boolean
  reveal?: boolean
  className?: string
}

/**
 * Food photography framed in a tall Moroccan/Art Deco arch with a brass
 * outline. Used sparingly: hero and product page only.
 */
export function ArchImage({
  src,
  alt,
  priority = false,
  reveal = false,
  className,
}: ArchImageProps) {
  return (
    <div className={cx('arch-frame', className)}>
      <div className={cx('arch aspect-[4/5] w-full', reveal && 'motion-safe:animate-arch-reveal')}>
        <ProductImage
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="h-full w-full"
        />
      </div>
    </div>
  )
}
