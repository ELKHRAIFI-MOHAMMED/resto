import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { Money } from '@/components/Price'
import { TextField } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLanguage } from '@/hooks/useLanguage'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'

import { ORDER_STATUSES, ordersApi } from '../api'
import { formatDateTime } from '../format'
import { TABLE, TD, TH } from '../helpers'
import { PageHeader, Pagination, StatusBadge } from '../ui'

const PAGE_SIZE = 25
const SELECT =
  'min-h-12 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-accent focus:outline-none'

export function OrdersPage() {
  const { t } = useTranslation()
  const language = useLanguage()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const page = Number(params.get('page') ?? 1)
  const filters = {
    status: params.get('status') ?? '',
    order_type: params.get('order_type') ?? '',
    unassigned: params.get('unassigned') ?? '',
    date_from: params.get('date_from') ?? '',
    date_to: params.get('date_to') ?? '',
  }

  const setFilter = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', { ...filters, search: debouncedSearch, page }],
    queryFn: () =>
      ordersApi.list({ ...filters, search: debouncedSearch, page, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000, // new WhatsApp orders show up without reloading
  })

  return (
    <>
      <PageHeader title={t('admin.orders.title')} />
      <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <TextField
          label={t('admin.common.search')}
          type="search"
          placeholder={t('admin.orders.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="text-sm">
          <span className="mb-2 block">{t('admin.orders.status')}</span>
          <select
            className={cx(SELECT, 'w-full')}
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">{t('admin.common.all')}</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`admin.status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-2 block">{t('admin.orders.type')}</span>
          <select
            className={cx(SELECT, 'w-full')}
            value={filters.order_type}
            onChange={(event) => setFilter('order_type', event.target.value)}
          >
            <option value="">{t('admin.common.all')}</option>
            <option value="delivery">{t('admin.orders.delivery')}</option>
            <option value="pickup">{t('admin.orders.pickup')}</option>
          </select>
        </label>
        <TextField
          label={t('admin.orders.from')}
          type="date"
          value={filters.date_from}
          onChange={(event) => setFilter('date_from', event.target.value)}
        />
        <TextField
          label={t('admin.orders.to')}
          type="date"
          value={filters.date_to}
          onChange={(event) => setFilter('date_to', event.target.value)}
        />
      </div>
      <label className="mb-6 flex w-fit cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={filters.unassigned === 'true'}
          onChange={(event) => setFilter('unassigned', event.target.checked ? 'true' : '')}
          className="size-4 accent-[var(--color-accent)]"
        />
        {t('admin.orders.unassignedFilter')}
      </label>

      {isPending ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {t('admin.orders.count', { count: data.count })}
            <span className="ms-3">{t('admin.orders.autoRefresh')}</span>
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>{t('admin.orders.reference')}</th>
                  <th className={TH}>{t('admin.orders.date')}</th>
                  <th className={TH}>{t('admin.orders.customer')}</th>
                  <th className={TH}>{t('admin.orders.type')}</th>
                  <th className={TH}>{t('admin.orders.total')}</th>
                  <th className={TH}>{t('admin.orders.courier')}</th>
                  <th className={TH}>{t('admin.orders.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((order) => (
                  <tr key={order.id} className="hover:bg-surface">
                    <td className={TD}>
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-medium text-accent hover:underline"
                        dir="ltr"
                      >
                        {order.reference}
                      </Link>
                    </td>
                    <td className={cx(TD, 'whitespace-nowrap tabular-nums')}>
                      {formatDateTime(order.created_at, language)}
                    </td>
                    <td className={TD}>
                      {order.customer_name}
                      <span className="block text-xs text-muted" dir="ltr">
                        {order.customer_phone}
                      </span>
                    </td>
                    <td className={TD}>
                      {t(`admin.orders.${order.order_type}`)}
                      {order.delivery_zone_name && (
                        <span className="block text-xs text-muted">{order.delivery_zone_name}</span>
                      )}
                    </td>
                    <td className={cx(TD, 'whitespace-nowrap')}>
                      <Money cents={parseMoney(order.total)} />
                    </td>
                    <td className={TD}>
                      {order.order_type === 'pickup' ? (
                        <span className="text-muted">-</span>
                      ) : (
                        (order.courier_name ?? (
                          <span className="text-accent">{t('admin.orders.unassigned')}</span>
                        ))
                      )}
                    </td>
                    <td className={TD}>
                      <StatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
                {data.results.length === 0 && (
                  <tr>
                    <td colSpan={7} className={cx(TD, 'text-center text-muted')}>
                      {t('admin.common.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            count={data.count}
            pageSize={PAGE_SIZE}
            onPage={(next) => setFilter('page', String(next))}
          />
        </>
      )}
    </>
  )
}
