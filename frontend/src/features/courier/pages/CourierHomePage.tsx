import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Money } from '@/components/Price'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'

import { courierApi, type CourierOrder } from '../api'

function DutySwitch() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: me } = useQuery({ queryKey: ['courier', 'me'], queryFn: courierApi.me })
  const toggle = useMutation({
    mutationFn: courierApi.setOnDuty,
    onSuccess: (profile) => queryClient.setQueryData(['courier', 'me'], profile),
  })
  if (!me) return <Skeleton className="h-24" />

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-medium">{me.name}</p>
          <p className={cx('text-sm', me.is_on_duty ? 'text-open' : 'text-muted')}>
            {me.is_on_duty ? t('courier.onDuty') : t('courier.offDuty')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={me.is_on_duty}
          aria-label={t('courier.onDuty')}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(!me.is_on_duty)}
          className={cx(
            'relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60',
            me.is_on_duty ? 'bg-open' : 'bg-border',
          )}
        >
          <span
            aria-hidden
            className={cx(
              'absolute top-1 size-6 rounded-full bg-background transition-all',
              me.is_on_duty ? 'end-1' : 'start-1',
            )}
          />
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        {me.zones.length
          ? t('courier.dutyHint', { zones: me.zones.join(', ') })
          : t('courier.noZones')}
      </p>
    </section>
  )
}

function OrderCard({ order }: { order: CourierOrder }) {
  const { t } = useTranslation()
  const items = order.items.reduce((count, item) => count + item.quantity, 0)
  return (
    <li>
      <Link
        to={`/livreur/orders/${order.id}`}
        className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium" dir="ltr">
              {order.reference}
            </span>
            <span
              className={cx(
                'rounded-full border px-2.5 py-0.5 text-xs',
                order.status === 'out_for_delivery'
                  ? 'border-accent/60 text-accent'
                  : order.status === 'completed'
                    ? 'border-border text-muted'
                    : 'border-open/60 text-open',
              )}
            >
              {t(`courier.status.${order.status}`)}
            </span>
          </div>
          <p className="mt-2">{order.customer_name}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            <bdi dir="auto">
              {order.delivery_address}
              {order.delivery_zone_name && `, ${order.delivery_zone_name}`}
            </bdi>
          </p>
          <div className="mt-3 flex items-baseline justify-between text-sm">
            <span className="text-muted">{t('courier.items', { count: items })}</span>
            <span>
              <span className="text-muted">{t('courier.toCollect')} </span>
              <Money cents={parseMoney(order.total)} className="font-medium text-accent" />
            </span>
          </div>
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted rtl:-scale-x-100" />
      </Link>
    </li>
  )
}

export function CourierHomePage() {
  const { t } = useTranslation()
  const [scope, setScope] = useState<'active' | 'done'>('active')
  const {
    data: orders,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['courier', 'orders', scope],
    queryFn: () => courierApi.orders(scope),
    refetchInterval: 20_000, // new assignments appear on their own
  })

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{t('courier.title')}</h1>
      <DutySwitch />
      <div role="tablist" className="flex gap-1">
        {(['active', 'done'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={scope === tab}
            onClick={() => setScope(tab)}
            className={cx(
              'min-h-10 rounded-full px-4 text-sm',
              scope === tab ? 'bg-foreground text-background' : 'text-muted hover:bg-surface',
            )}
          >
            {t(`courier.${tab}`)}
          </button>
        ))}
      </div>
      {isPending ? (
        <Skeleton className="h-40" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-muted">
          {scope === 'active' ? t('courier.empty') : t('courier.emptyDone')}
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      )}
      {scope === 'active' && (
        <p className="text-center text-xs text-muted">{t('courier.refresh')}</p>
      )}
    </div>
  )
}
