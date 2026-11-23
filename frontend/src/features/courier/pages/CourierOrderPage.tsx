import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Navigation, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { OfferChoices } from '@/components/OfferChoices'
import { Money } from '@/components/Price'
import { Button } from '@/components/ui/Button'
import { buttonClassName } from '@/components/ui/buttonClassName'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useLanguage } from '@/hooks/useLanguage'
import { formatMoney, parseMoney } from '@/lib/money'
import { summarizeChoices } from '@/lib/offers'
import { useToastStore } from '@/store/toast'

import { courierApi, directionsUrl } from '../api'

export function CourierOrderPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { t } = useTranslation()
  const language = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)
  const {
    data: order,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['courier', 'order', orderId],
    queryFn: () => courierApi.order(orderId),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['courier', 'orders'] })
  const pickup = useMutation({
    mutationFn: () => courierApi.pickup(orderId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['courier', 'order', orderId], updated)
      void refresh()
      showToast({ message: t('courier.pickedUp') })
    },
  })
  const deliver = useMutation({
    mutationFn: () => courierApi.deliver(orderId),
    onSuccess: () => {
      void refresh()
      showToast({ message: t('courier.delivered') })
      navigate('/livreur')
    },
  })

  if (isPending) return <Skeleton className="h-96" />
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />

  const phone = order.customer_phone.replace(/\D/g, '')
  const amount = formatMoney(parseMoney(order.total), language)
  const failed = pickup.error ?? deliver.error

  return (
    <div className="space-y-6">
      <Link to="/livreur" className="text-sm text-muted hover:text-foreground">
        {t('courier.back')}
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-light whitespace-nowrap tabular-nums" dir="ltr">
          {order.reference}
        </h1>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs whitespace-nowrap text-muted">
          {t(`courier.status.${order.status}`)}
        </span>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">{t('courier.toCollect')}</p>
        <p className="mt-1 text-3xl font-light text-accent tabular-nums">
          <Money cents={parseMoney(order.total)} />
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-lg">{order.customer_name}</p>
        <p className="text-muted">
          <bdi dir="auto">
            {order.delivery_address}, {order.city}
          </bdi>
        </p>
        {order.delivery_zone_name && (
          <p className="text-sm text-muted">{order.delivery_zone_name}</p>
        )}
        <div className="grid grid-cols-3 gap-2 pt-3">
          <a href={`tel:${order.customer_phone}`} className={buttonClassName('secondary', 'sm')}>
            <Phone aria-hidden className="size-4" />
            {t('courier.call')}
          </a>
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName('secondary', 'sm')}
          >
            <MessageCircle aria-hidden className="size-4" />
            {t('courier.whatsapp')}
          </a>
          <a
            href={directionsUrl(order)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName('secondary', 'sm')}
          >
            <Navigation aria-hidden className="size-4" />
            {t('courier.directions')}
          </a>
        </div>
      </section>

      {order.customer_notes && (
        <section className="rounded-2xl border border-accent/40 p-4">
          <p className="text-sm text-muted">{t('courier.notes')}</p>
          <p className="mt-1">{order.customer_notes}</p>
        </section>
      )}

      <ul className="divide-y divide-border border-y border-border">
        {order.items.map((item) => (
          <li key={item.id} className="py-3">
            <span className="font-medium">
              {item.quantity}× {item.product_name}
            </span>
            {(item.variant_name || item.addons.length > 0) && (
              <span className="block text-sm text-muted">
                {[item.variant_name, ...item.addons.map((addon) => `+ ${addon.addon_name}`)]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            )}
            <OfferChoices summary={summarizeChoices(item.choices)} />
            {item.special_instructions && (
              <span className="block text-sm text-muted italic">{item.special_instructions}</span>
            )}
          </li>
        ))}
      </ul>

      {failed && (
        <p role="alert" className="text-sm text-danger">
          {t('courier.error')}
        </p>
      )}
      {(order.status === 'confirmed' || order.status === 'preparing') && (
        <Button className="w-full" disabled={pickup.isPending} onClick={() => pickup.mutate()}>
          {t('courier.pickup')}
        </Button>
      )}
      {order.status === 'out_for_delivery' && (
        <Button
          className="w-full"
          disabled={deliver.isPending}
          onClick={() => {
            if (
              window.confirm(t('courier.deliverConfirm', { reference: order.reference, amount }))
            ) {
              deliver.mutate()
            }
          }}
        >
          {t('courier.deliver')}
        </Button>
      )}
    </div>
  )
}
