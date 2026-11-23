import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { ApiError } from '@/services/api'
import { useToastStore } from '@/store/toast'

import { couriersApi, ordersApi, type AdminOrderDetail } from './api'
import { formatDateTime } from './format'
import { FormError, Section } from './ui'

const CLOSED = ['completed', 'cancelled']

/** Assign a courier to a delivery order: by hand, or the best one for its zone. */
export function CourierAssignment({ order }: { order: AdminOrderDetail }) {
  const { t } = useTranslation()
  const language = useLanguage()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  const [selected, setSelected] = useState<string>(order.courier ? String(order.courier) : '')

  const couriers = useQuery({ queryKey: ['admin', 'couriers'], queryFn: couriersApi.list })
  // Couriers serving the order's zone first, then the others; inactive accounts are left out.
  const options = (couriers.data ?? [])
    .filter((courier) => courier.is_active)
    .map((courier) => ({
      ...courier,
      servesZone: order.delivery_zone !== null && courier.zones.includes(order.delivery_zone),
      label: [courier.first_name, courier.last_name].filter(Boolean).join(' ') || courier.email,
    }))
    .sort(
      (a, b) => Number(b.servesZone) - Number(a.servesZone) || a.active_orders - b.active_orders,
    )

  const onUpdated = (updated: AdminOrderDetail, message: string) => {
    queryClient.setQueryData(['admin', 'order', order.id], updated)
    void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'couriers'] })
    setSelected(updated.courier ? String(updated.courier) : '')
    showToast({ message })
  }
  const assign = useMutation({
    mutationFn: (courier: number | null) => ordersApi.assignCourier(order.id, courier),
    onSuccess: (updated) =>
      onUpdated(
        updated,
        updated.courier_name
          ? t('admin.orders.assigned', { name: updated.courier_name })
          : t('admin.orders.unassignedDone'),
      ),
  })
  const auto = useMutation({
    mutationFn: () => ordersApi.autoAssign(order.id),
    onSuccess: (updated) =>
      onUpdated(updated, t('admin.orders.assigned', { name: updated.courier_name ?? '' })),
  })

  if (order.order_type !== 'delivery') {
    return (
      <Section title={t('admin.orders.courierTitle')}>
        <p className="text-sm text-muted">{t('admin.orders.pickupOnly')}</p>
      </Section>
    )
  }

  const closed = CLOSED.includes(order.status)
  const locked = closed || Boolean(order.picked_up_at)
  const noneAvailable = auto.error instanceof ApiError && auto.error.code === 'no_courier_available'
  const busy = assign.isPending || auto.isPending

  return (
    <Section title={t('admin.orders.courierTitle')}>
      <p className="text-sm text-muted">{t('admin.orders.courier')}</p>
      <p className="mt-1 text-base">
        {order.courier_name ?? <span className="text-accent">{t('admin.orders.unassigned')}</span>}
      </p>
      {order.courier_phone && (
        <a href={`tel:${order.courier_phone}`} className="text-sm text-accent hover:underline">
          <bdi dir="ltr">{order.courier_phone}</bdi>
        </a>
      )}

      <dl className="mt-4 space-y-1 text-xs text-muted">
        {order.assigned_at && (
          <div>
            {t('admin.orders.assignedAt')} {formatDateTime(order.assigned_at, language)}
          </div>
        )}
        {order.picked_up_at && (
          <div>
            {t('admin.orders.pickedUpAt')} {formatDateTime(order.picked_up_at, language)}
          </div>
        )}
        {order.delivered_at && (
          <div>
            {t('admin.orders.deliveredAt')} {formatDateTime(order.delivered_at, language)}
          </div>
        )}
      </dl>

      {!locked && (
        <div className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="mb-2 block">{t('admin.orders.chooseCourier')}</span>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground focus:border-accent focus:outline-none"
            >
              <option value="">{t('admin.orders.chooseCourier')}</option>
              {options.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {`${courier.label} (${[
                    courier.servesZone ? t('admin.orders.servesZone') : null,
                    courier.is_on_duty ? t('admin.couriers.onDuty') : t('admin.couriers.offDuty'),
                    `${t('admin.couriers.activeOrders')}: ${courier.active_orders}`,
                  ]
                    .filter(Boolean)
                    .join(', ')})`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !selected || selected === String(order.courier ?? '')}
              onClick={() => assign.mutate(Number(selected))}
            >
              {t('admin.orders.assign')}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => auto.mutate()}>
              <Wand2 aria-hidden className="size-4" />
              {t('admin.orders.autoAssign')}
            </Button>
            {order.courier && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => assign.mutate(null)}>
                {t('admin.orders.unassign')}
              </Button>
            )}
          </div>
          {noneAvailable ? (
            <p role="alert" className="text-sm text-danger">
              {t('admin.orders.noCourierAvailable')}
            </p>
          ) : (
            <FormError error={assign.error ?? auto.error} />
          )}
        </div>
      )}
    </Section>
  )
}
