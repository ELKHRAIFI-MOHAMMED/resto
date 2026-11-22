import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Price } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { simpleCartLine, useAddToCart } from '@/features/cart/useAddToCart'
import { cx } from '@/lib/cx'
import type { ProductSummary } from '@/types/catalog'

/**
 * A dish as on a printed menu: name, dotted leader, price; description below.
 * Products with options open their page; others are added in one tap.
 */
export function ProductRow({ product }: { product: ProductSummary }) {
  const { t } = useTranslation()
  const addToCart = useAddToCart()
  const unavailable = !product.is_available

  return (
    <article
      className={cx('group relative flex gap-4 py-5 sm:gap-6', unavailable && 'opacity-60')}
      aria-labelledby={`product-${product.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline">
          <h3 id={`product-${product.id}`} className="text-lg font-medium text-foreground">
            <Link
              to={`/menu/${product.slug}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {product.name}
            </Link>
          </h3>
          <span aria-hidden className="leader" />
          <Price
            amount={product.effective_price}
            original={product.is_on_sale ? product.price : null}
          />
        </div>
        {product.description && (
          <p className="mt-1 line-clamp-2 max-w-prose text-sm text-muted">{product.description}</p>
        )}
        <div className="relative z-10 mt-3 flex items-center gap-3">
          {unavailable ? (
            <span className="text-sm text-muted">{t('common.unavailable')}</span>
          ) : product.has_options ? (
            <ButtonLink
              to={`/menu/${product.slug}`}
              variant="secondary"
              size="sm"
              aria-label={t('menu.chooseLabel', { name: product.name })}
            >
              {t('menu.choose')}
            </ButtonLink>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addToCart(simpleCartLine(product))}
              aria-label={t('menu.addLabel', { name: product.name })}
            >
              {t('menu.add')}
            </Button>
          )}
        </div>
      </div>
      <ProductImage
        src={product.image}
        alt={product.name}
        width={112}
        height={112}
        sizes="112px"
        className="size-24 shrink-0 rounded-xl sm:size-28"
      />
    </article>
  )
}
