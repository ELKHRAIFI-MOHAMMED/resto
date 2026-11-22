import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Money } from '@/components/Price'
import { Button } from '@/components/ui/Button'
import { buttonClassName } from '@/components/ui/buttonClassName'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useLanguage } from '@/hooks/useLanguage'
import { parseMoney } from '@/lib/money'
import { ApiError } from '@/services/api'
import { useToastStore } from '@/store/toast'

import { ordersApi, type OrderStatus } from '../api'
import { TABLE, TD, TH } from '../helpers'
import { FormError, PageHeader, Section, StatusBadge } from '../ui'
import { formatDateTime } from '../format'

export function OrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { t } = useTranslation()
  const language = useLanguage()
  const queryClient = useQueryClient()
  const showToast = useToastStore((state) => state.show)

  const {
    data: order,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'order', orderId],
    queryFn: () => ordersApi.get(orderId),
  })

  const changeStatus = useMutation({
    mutationFn: (status: Exclude<OrderStatus, 'pending'>) => ordersApi.setStatus(orderId, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'order', orderId], updated)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      showToast({
        message: t('admin.orders.statusUpdated', { status: t(`admin.status.${updated.status}`) }),
      })
    },
  })

  if (isPending) return <Skeleton className="h-96" />
  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <>
          <p className="mb-4 text-lg">{t('admin.orders.notFound')}</p>
          <Link to="/admin/orders" className="text-accent hover:underline">
            {t('admin.common.back')}
          </Link>
        </>
      )
    }
    return <ErrorState error={error} onRetry={() => void refetch()} />
  }

  const onStatus = (status: Exclude<OrderStatus, 'pending'>) => {
    if (
      status === 'cancelled' &&
      !window.confirm(t('admin.orders.cancelConfirm', { reference: order.reference }))
    )
      return
    changeStatus.mutate(status)
  }
  const customerDigits = order.customer_phone.replace(/\D/g, '')

  return (
    <>
      <Link
        to="/admin/orders"
        className="mb-4 inline-block text-sm text-muted hover:text-foreground"
      >
        {t('admin.common.back')}
      </Link>
      <PageHeader
        title={t('admin.orders.detailTitle', { reference: order.reference })}
        actions={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section title={t('admin.orders.changeStatus')}>
            {order.allowed_statuses.length ? (
              <>
                {order.status === 'pending' && (
                  <p className="mb-4 text-sm text-muted">{t('admin.orders.pendingHint')}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  {order.allowed_statuses.map((status) => (
                    <Button
                      key={status}
                      variant={
                        status === 'cancelled'
                          ? 'ghost'
                          : status === order.allowed_statuses[0]
                            ? 'primary'
                            : 'secondary'
                      }
                      disabled={changeStatus.isPending}
                      onClick={() => onStatus(status)}
                    >
                      {t(`admin.statusAction.${status}`)}
                    </Button>
                  ))}
                </div>
                <div className="mt-4">
                  <FormError error={changeStatus.error} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">{t('admin.orders.finalStatus')}</p>
            )}
          </Section>

          <Section title={t('admin.orders.itemsTitle')}>
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>{t('admin.orders.items')}</th>
                    <th className={TH}>{t('admin.orders.unitPrice')}</th>
                    <th className={TH}>{t('admin.orders.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className={TD}>
                        <span className="font-medium">
                          {item.quantity}× {item.product_name}
                        </span>
                        {(item.variant_name || item.addons.length > 0) && (
                          <span className="block text-xs text-muted">
                            {[
                              item.variant_name,
                              ...item.addons.map((addon) => `+ ${addon.addon_name}`),
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                        {item.special_instructions && (
                          <span className="block text-xs text-muted italic">
                            {item.special_instructions}
                          </span>
                        )}
                      </td>
                      <td className={TD}>
                        <Money cents={parseMoney(item.unit_price)} />
                      </td>
                      <td className={TD}>
                        <Money cents={parseMoney(item.line_total)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t('admin.orders.subtotal')}</dt>
                <dd>
                  <Money cents={parseMoney(order.subtotal)} />
                </dd>
              </div>
              {order.order_type === 'delivery' && (
                <div className="flex justify-between">
                  <dt className="text-muted">{t('admin.orders.deliveryFee')}</dt>
                  <dd>
                    <Money cents={parseMoney(order.delivery_fee)} />
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-lg">
                <dt>{t('admin.orders.total')}</dt>
                <dd className="text-accent">
                  <Money cents={parseMoney(order.total)} />
                </dd>
              </div>
            </dl>
          </Section>

          <Section title={t('admin.orders.messageTitle')}>
            <pre dir="auto" className="font-sans text-sm whitespace-pre-wrap text-muted">
              {order.whatsapp_message}
            </pre>
          </Section>
        </div>

        <Section title={t('admin.orders.customerTitle')}>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-muted">{t('admin.orders.customer')}</dt>
              <dd className="mt-1 text-base">{order.customer_name}</dd>
              <dd className="text-muted">
                <bdi dir="ltr">{order.customer_phone}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t('admin.orders.type')}</dt>
              <dd className="mt-1">{t(`admin.orders.${order.order_type}`)}</dd>
            </div>
            {order.order_type === 'delivery' && (
              <>
                <div>
                  <dt className="text-muted">{t('admin.orders.address')}</dt>
                  <dd className="mt-1">
                    {/* Latin addresses keep their own order inside Arabic text. */}
                    <bdi dir="auto">
                      {order.delivery_address}, {order.city}
                    </bdi>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t('admin.orders.zone')}</dt>
                  <dd className="mt-1">{order.delivery_zone_name}</dd>
                </div>
              </>
            )}
            {order.customer_notes && (
              <div>
                <dt className="text-muted">{t('admin.orders.notes')}</dt>
                <dd className="mt-1">{order.customer_notes}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted">{t('admin.orders.createdAt')}</dt>
              <dd className="mt-1 tabular-nums">{formatDateTime(order.created_at, language)}</dd>
            </div>
            {order.confirmed_at && (
              <div>
                <dt className="text-muted">{t('admin.orders.confirmedAt')}</dt>
                <dd className="mt-1 tabular-nums">
                  {formatDateTime(order.confirmed_at, language)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted">{t('admin.orders.language')}</dt>
              <dd className="mt-1 uppercase">{order.language}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={`https://wa.me/${customerDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName('primary', 'sm')}
            >
              <MessageCircle aria-hidden className="size-4" />
              {t('admin.orders.replyWhatsApp')}
            </a>
            <a href={`tel:${order.customer_phone}`} className={buttonClassName('secondary', 'sm')}>
              <Phone aria-hidden className="size-4" />
              {t('admin.orders.call')}
            </a>
          </div>
        </Section>
      </div>
    </>
  )
}
