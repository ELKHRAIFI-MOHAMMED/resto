import { useTranslation } from 'react-i18next'

import { cx } from '@/lib/cx'
import type { ChoiceSummary } from '@/lib/offers'

/** The dishes picked in an offer, one line per group ("Plats : 2× Tacos, 1× Pizza"). */
export function OfferChoices({
  summary,
  className,
}: {
  summary: ChoiceSummary[]
  className?: string
}) {
  const { t } = useTranslation()
  if (!summary.length) return null
  return (
    <ul className={cx('space-y-0.5 text-sm text-muted', className)}>
      {summary.map(({ group, items }) => (
        <li key={group}>{t('offers.choiceLine', { group, items })}</li>
      ))}
    </ul>
  )
}
