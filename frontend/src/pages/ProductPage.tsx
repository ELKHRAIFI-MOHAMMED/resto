import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { ArchImage } from '@/components/ArchImage'
import { Price } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { ProductOptionsForm } from '@/features/products/ProductOptionsForm'
import { useProduct } from '@/hooks/useCatalog'
import { cx } from '@/lib/cx'
import { ApiError } from '@/services/api'
import type { ProductDetail } from '@/types/catalog'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const { data: product, isPending, isError, error, refetch } = useProduct(slug)

  if (isPending) return <ProductSkeleton />

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <title>{`${t('product.notFoundTitle')} | ${t('brand.name')}`}</title>
          <meta name="robots" content="noindex" />
          <EmptyState
            title={t('product.notFoundTitle')}
            hint={t('product.notFoundText')}
            action={<ButtonLink to="/menu">{t('menu.title')}</ButtonLink>}
          />
        </div>
      )
    }
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  return <ProductView key={product.id} product={product} />
}

function ProductView({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const photos = [product.image, ...product.images.map((item) => item.image)].filter(
    (src): src is string => Boolean(src),
  )
  const [photoIndex, setPhotoIndex] = useState(0)
  const description = product.description || t('product.metaFallback', { name: product.name })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <title>{`${product.name} | ${t('brand.name')}`}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={product.name} />
      <meta property="og:description" content={description} />
      {product.image && <meta property="og:image" content={product.image} />}

      <nav aria-label={t('nav.breadcrumb')} className="mb-10 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link to="/menu" className="hover:text-foreground">
              {t('menu.title')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to={`/menu?category=${product.category.slug}`} className="hover:text-foreground">
              {product.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <ArchImage src={photos[photoIndex] ?? null} alt={product.name} priority />
          {photos.length > 1 && (
            <div className="mt-6 flex gap-3">
              {photos.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhotoIndex(index)}
                  aria-label={t('product.showPhoto', { index: index + 1 })}
                  aria-pressed={index === photoIndex}
                  className={cx(
                    'overflow-hidden rounded-lg border transition-colors',
                    index === photoIndex
                      ? 'border-accent'
                      : 'border-transparent opacity-70 hover:opacity-100',
                  )}
                >
                  <ProductImage src={src} alt="" width={64} height={64} className="size-16" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-5xl sm:text-6xl">{product.name}</h1>
          <p className="mt-4 text-2xl">
            <Price
              amount={product.effective_price}
              original={product.is_on_sale ? product.price : null}
            />
          </p>
          {product.description && (
            <p className="mt-6 max-w-prose text-lg text-muted">{product.description}</p>
          )}
          <div className="mt-10">
            <ProductOptionsForm product={product} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[5fr_6fr] lg:gap-20">
      <Skeleton className="arch aspect-[4/5] w-full max-w-md" />
      <div className="space-y-4">
        <Skeleton className="h-14 w-3/4" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}
