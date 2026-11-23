import { Pencil, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { OfferChoices } from '@/components/OfferChoices'
import { Money } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/StateMessage'
import { DeliveryEstimate } from '@/features/cart/DeliveryEstimate'
import { useCartQuote } from '@/features/cart/useCartQuote'
import { describeOrderError } from '@/features/checkout/errors'
import { useLanguage } from '@/hooks/useLanguage'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'
import { cartLineHref, summarizeCartChoices } from '@/lib/offers'
import { selectItemCount, selectSubtotalCents, useCartStore } from '@/store/cart'

export function CartPage() {
  const { t } = useTranslation()
  const language = useLanguage()
  const lines = useCartStore((state) => state.lines)
  const setQuantity = useCartStore((state) => state.setQuantity)
  const removeLine = useCartStore((state) => state.removeLine)
  const count = useCartStore(selectItemCount)
  const estimate = useCartStore(selectSubtotalCents)
  const { quote, error, isPending, lineIssues, pricesChanged } = useCartQuote()
  const dismissPriceNotice = useCartStore((state) => state.dismissPriceNotice)
  useEffect(() => dismissPriceNotice, [dismissPriceNotice]) // clear the notice on leave

  const hasIssues = Object.keys(lineIssues).length > 0
  const blockingError = error && !hasIssues ? describeOrderError(error, t, language).message : null
  const subtotal = quote ? parseMoney(quote.subtotal) : estimate
  const canCheckout = Boolean(quote) && !isPending && !hasIssues && !error

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
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
        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <section aria-label={t('cart.items', { count })}>
            <p className="text-muted">{t('cart.items', { count })}</p>
            {pricesChanged && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-accent/40 px-4 py-3 text-sm"
              >
                {t('cart.pricesUpdated')}
              </p>
            )}
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {lines.map((line) => {
                const issue = lineIssues[line.key]
                const editUrl = cartLineHref(line, true)
                const editable =
                  issue !== 'product_not_found' &&
                  issue !== 'product_unavailable' &&
                  issue !== 'offer_not_found'
                return (
                  <li key={line.key} className="flex gap-4 py-6 sm:gap-6">
                    <ProductImage
                      src={line.image}
                      alt=""
                      width={80}
                      height={80}
                      className={cx('size-20 shrink-0 rounded-xl', issue && 'opacity-50')}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-4">
                        <Link
                          to={cartLineHref(line)}
                          className="flex-1 font-medium hover:text-accent"
                        >
                          {line.name}
                        </Link>
                        <Money
                          cents={line.unitPriceCents * line.quantity}
                          className={issue ? 'text-muted line-through' : 'text-accent'}
                        />
                      </div>
                      {(line.variantName || line.addonNames.length > 0) && (
                        <p className="mt-1 text-sm text-muted">
                          {[line.variantName, ...line.addonNames.map((name) => `+ ${name}`)]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                      <OfferChoices summary={summarizeCartChoices(line.choices)} className="mt-1" />
                      {line.specialInstructions && (
                        <p className="mt-1 text-sm text-muted italic">{line.specialInstructions}</p>
                      )}
                      {issue && (
                        <p className="mt-2 text-sm text-danger">
                          {t(`cart.issues.${issue}`)}{' '}
                          {editable && (
                            <Link
                              to={editUrl}
                              className="underline underline-offset-4 hover:text-foreground"
                            >
                              {t('cart.chooseAgain')}
                            </Link>
                          )}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-3">
                        {!issue && (
                          <QuantityStepper
                            size="sm"
                            value={line.quantity}
                            onChange={(quantity) => setQuantity(line.key, quantity)}
                            label={t('cart.quantityOf', { name: line.name })}
                          />
                        )}
                        {editable && (
                          <Link
                            to={editUrl}
                            aria-label={t('cart.edit', { name: line.name })}
                            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
                          >
                            <Pencil aria-hidden className="size-4" />
                            <span aria-hidden>{t('cart.editShort')}</span>
                          </Link>
                        )}
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
                )
              })}
            </ul>
            <div className="mt-8">
              <Link
                to="/menu"
                className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                {t('cart.continue')}
              </Link>
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-24">
            <div className="flex items-baseline justify-between gap-4 text-lg" aria-live="polite">
              <span>{t('cart.subtotal')}</span>
              <Money cents={subtotal} className={cx('text-accent', isPending && 'opacity-50')} />
            </div>
            {isPending && <p className="mt-1 text-xs text-muted">{t('cart.checking')}</p>}
            <div className="mt-4">
              <DeliveryEstimate subtotalCents={subtotal} />
            </div>
            {(hasIssues || blockingError) && (
              <p role="alert" className="mt-4 text-sm text-danger">
                {blockingError ?? t('cart.fixItems')}
              </p>
            )}
            {canCheckout ? (
              <ButtonLink to="/checkout" className="mt-6 w-full">
                {t('cart.checkout')}
              </ButtonLink>
            ) : (
              <Button disabled className="mt-6 w-full">
                {t('cart.checkout')}
              </Button>
            )}
            <p className="mt-3 text-xs text-muted">{t('cart.totalNote')}</p>
          </aside>
        </div>
      )}
    </div>
  )
}
