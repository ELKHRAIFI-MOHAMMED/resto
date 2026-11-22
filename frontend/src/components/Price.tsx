import { useTranslation } from 'react-i18next'

import { useLanguage } from '@/hooks/useLanguage'
import { cx } from '@/lib/cx'
import { formatMoney, parseMoney } from '@/lib/money'

interface PriceProps {
  /** The price the customer pays (decimal string from the API). */
  amount: string
  /** Original price when the product is on sale. */
  original?: string | null
  className?: string
}

export function Price({ amount, original, className }: PriceProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const current = formatMoney(parseMoney(amount), language)
  const previous =
    original && original !== amount ? formatMoney(parseMoney(original), language) : null

  return (
    <span className={cx('inline-flex items-baseline gap-2 whitespace-nowrap', className)}>
      <bdi className="text-accent">{current}</bdi>
      {previous && (
        <s className="text-sm text-muted">
          <span className="sr-only">{t('common.insteadOf', { price: previous })}</span>
          <bdi aria-hidden>{previous}</bdi>
        </s>
      )}
    </span>
  )
}

/** A plain formatted amount in centimes (for estimates and totals). */
export function Money({ cents, className }: { cents: number; className?: string }) {
  const language = useLanguage()
  return <bdi className={cx('whitespace-nowrap', className)}>{formatMoney(cents, language)}</bdi>
}
