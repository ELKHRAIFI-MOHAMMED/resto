import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { OfferChoices } from '@/components/OfferChoices'
import { Money } from '@/components/Price'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'
import { summarizeCartChoices, summarizeChoices } from '@/lib/offers'
import type { CartLine } from '@/store/cart'
import type { OrderType, Quote } from '@/types/orders'

interface OrderSummaryProps {
  lines: CartLine[]
  quote: Quote | undefined
  isPending: boolean
  orderType: OrderType | null
  hasZone: boolean
}

/** Checkout summary. Amounts come from the backend quote, never computed here. */
export function OrderSummary({ lines, quote, isPending, orderType, hasZone }: OrderSummaryProps) {
  const { t } = useTranslation()
  const items = quote?.items

  let delivery: ReactNode = null
  if (orderType === 'delivery') {
    if (!hasZone) delivery = <span className="text-muted">{t('checkout.deliveryChooseZone')}</span>
    else if (quote?.order_type === 'delivery')
      delivery =
        parseMoney(quote.delivery_fee) === 0 ? (
          t('checkout.deliveryFree')
        ) : (
          <Money cents={parseMoney(quote.delivery_fee)} />
        )
  }

  return (
    <section
      aria-labelledby="summary-title"
      aria-busy={isPending}
      className="h-fit rounded-2xl border border-border bg-surface p-6 lg:sticky lg:top-24"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="summary-title" className="font-display text-2xl">
          {t('checkout.summaryTitle')}
        </h2>
        <Link
          to="/cart"
          className="text-sm whitespace-nowrap text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('checkout.editCart')}
        </Link>
      </div>

      <ul className="mt-6 space-y-3 text-sm">
        {lines.map((line, index) => {
          const item = items?.[index]
          const options = item
            ? [item.variant_name, ...item.addons.map((addon) => `+ ${addon.name}`)]
            : [line.variantName, ...line.addonNames.map((name) => `+ ${name}`)]
          return (
            <li key={line.key} className="flex gap-3">
              <span className="text-muted tabular-nums">{line.quantity}×</span>
              <span className="flex-1">
                {item?.product_name ?? line.name}
                {options.some(Boolean) && (
                  <span className="block text-xs text-muted">
                    {options.filter(Boolean).join(', ')}
                  </span>
                )}
                <OfferChoices
                  summary={
                    item?.offer != null
                      ? summarizeChoices(item.choices)
                      : summarizeCartChoices(line.choices)
                  }
                  className="text-xs"
                />
              </span>
              <Money
                cents={item ? parseMoney(item.line_total) : line.unitPriceCents * line.quantity}
              />
            </li>
          )
        })}
      </ul>

      <dl
        className={cx(
          'mt-6 space-y-2 border-t border-border pt-4 text-sm',
          isPending && 'opacity-60',
        )}
      >
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('checkout.subtotal')}</dt>
          <dd>{quote ? <Money cents={parseMoney(quote.subtotal)} /> : '…'}</dd>
        </div>
        {delivery && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t('checkout.delivery_fee')}</dt>
            <dd>{delivery}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-border pt-3 text-lg">
          <dt>{t('checkout.total')}</dt>
          <dd className="text-accent">{quote ? <Money cents={parseMoney(quote.total)} /> : '…'}</dd>
        </div>
      </dl>
    </section>
  )
}
