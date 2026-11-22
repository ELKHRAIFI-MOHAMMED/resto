import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Money } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { QuantityStepper } from '@/components/QuantityStepper'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/StateMessage'
import { selectItemCount, selectSubtotalCents, useCartStore } from '@/store/cart'

/**
 * Cart contents from the local store. Delivery fees, the authoritative total
 * and checkout are added with the ordering flow (backend quote endpoint).
 */
export function CartPage() {
  const { t } = useTranslation()
  const lines = useCartStore((state) => state.lines)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const removeLine = useCartStore((state) => state.removeLine)
  const count = useCartStore(selectItemCount)
  const subtotal = useCartStore(selectSubtotalCents)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
      <title>{`${t('cart.title')} | ${t('brand.name')}`}</title>
      <meta name="description" content={t('cart.metaDescription')} />
      <meta name="robots" content="noindex" />

      <h1 className="font-display text-5xl sm:text-6xl">{t('cart.title')}</h1>

      {lines.length === 0 ? (
        <EmptyState
          title={t('cart.empty')}
          hint={t('cart.emptyHint')}
          action={<ButtonLink to="/menu">{t('cart.browse')}</ButtonLink>}
        />
      ) : (
        <>
          <p className="mt-3 text-muted">{t('cart.items', { count })}</p>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {lines.map((line) => (
              <li key={line.key} className="flex gap-4 py-6 sm:gap-6">
                <ProductImage
                  src={line.image}
                  alt=""
                  width={80}
                  height={80}
                  className="size-20 shrink-0 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-4">
                    <Link
                      to={`/menu/${line.slug}`}
                      className="flex-1 font-medium hover:text-accent"
                    >
                      {line.name}
                    </Link>
                    <Money cents={line.unitPriceCents * line.quantity} className="text-accent" />
                  </div>
                  {(line.variantName || line.addonNames.length > 0) && (
                    <p className="mt-1 text-sm text-muted">
                      {[line.variantName, ...line.addonNames.map((name) => `+ ${name}`)]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {line.specialInstructions && (
                    <p className="mt-1 text-sm text-muted italic">{line.specialInstructions}</p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <QuantityStepper
                      size="sm"
                      value={line.quantity}
                      onChange={(quantity) => setQuantity(line.key, quantity)}
                      label={t('cart.quantityOf', { name: line.name })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      aria-label={t('cart.remove', { name: line.name })}
                      className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-danger"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-baseline justify-between gap-4 text-lg">
            <span>{t('cart.subtotal')}</span>
            <Money cents={subtotal} className="text-accent" />
          </div>
          <p className="mt-2 text-sm text-muted">{t('cart.totalNote')}</p>
          <div className="mt-10">
            <ButtonLink to="/menu" variant="secondary">
              {t('cart.continue')}
            </ButtonLink>
          </div>
        </>
      )}
    </div>
  )
}
