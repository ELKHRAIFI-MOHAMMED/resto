import { useTranslation } from 'react-i18next'

import { useDeliveryZones, useRestaurant } from '@/hooks/useCatalog'
import { useLanguage } from '@/hooks/useLanguage'
import { formatMoney, parseMoney } from '@/lib/money'

/**
 * What delivery will cost, before the customer picks a neighbourhood:
 * the fee range across zones and the distance to free delivery.
 */
export function DeliveryEstimate({ subtotalCents }: { subtotalCents: number }) {
  const { t } = useTranslation()
  const language = useLanguage()
  const { data: restaurant } = useRestaurant()
  const { data: zones } = useDeliveryZones()
  if (!restaurant) return null

  const money = (cents: number) => formatMoney(cents, language)
  const notes: string[] = []

  if (restaurant.delivery_enabled && zones?.length) {
    const fees = zones.map((zone) => parseMoney(zone.delivery_fee))
    const min = Math.min(...fees)
    const max = Math.max(...fees)
    notes.push(
      min === max
        ? t('cart.deliveryFlat', { fee: money(min) })
        : t('cart.deliveryRange', { min: money(min), max: money(max) }),
    )
    if (restaurant.free_delivery_threshold) {
      const remaining = parseMoney(restaurant.free_delivery_threshold) - subtotalCents
      notes.push(
        remaining > 0
          ? t('cart.freeDeliveryRemaining', { amount: money(remaining) })
          : t('cart.freeDeliveryReached'),
      )
    }
  }
  if (restaurant.pickup_enabled) notes.push(t('cart.pickupFree'))

  return (
    <ul className="space-y-1 text-sm text-muted">
      {notes.map((note) => (
        <li key={note}>
          <bdi>{note}</bdi>
        </li>
      ))}
    </ul>
  )
}
