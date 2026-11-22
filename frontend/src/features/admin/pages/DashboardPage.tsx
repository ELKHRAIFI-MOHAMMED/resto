import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Money } from '@/components/Price'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useLanguage } from '@/hooks/useLanguage'
import type { Language } from '@/i18n/languages'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'

import { dashboardApi, ORDER_STATUSES, type Dashboard } from '../api'
import { TABLE, TD, TH } from '../helpers'
import { PageHeader, Section, StatusBadge } from '../ui'

const PERIODS = [7, 30, 90] as const
const LOCALES: Record<Language, string> = { fr: 'fr-MA', ar: 'ar-MA', en: 'en-GB' }

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      {/* Jost lining figures: Italiana's old-style numerals are hard to read as data. */}
      <p className="mt-2 text-3xl font-light tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  )
}

/** Orders per day: one series, so one hue and no legend; hover shows the value. */
function OrdersChart({ days }: { days: Dashboard['orders_by_date'] }) {
  const { t } = useTranslation()
  const language = useLanguage()
  const max = Math.max(1, ...days.map((day) => day.orders))
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALES[language], { ...options, timeZone: 'UTC' }).format(
      new Date(date),
    )
  const first = days[0]?.date ?? ''
  const last = days.at(-1)?.date ?? ''
  const labelEvery = Math.ceil(days.length / 7)

  return (
    <figure>
      <div
        role="img"
        aria-label={t('admin.dashboard.chartLabel', {
          from: format(first, { day: 'numeric', month: 'long' }),
          to: format(last, { day: 'numeric', month: 'long' }),
        })}
        className="flex h-48 items-end gap-[2px] border-b border-border"
        dir="ltr"
      >
        {days.map((day) => (
          <div key={day.date} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80"
              style={{ height: `${(day.orders / max) * 100}%`, minHeight: day.orders ? 2 : 0 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs whitespace-nowrap group-hover:block">
              {format(day.date, { day: 'numeric', month: 'short' })}: {day.orders}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] text-[0.6875rem] text-muted" dir="ltr" aria-hidden>
        {days.map((day, index) => (
          <span key={day.date} className="flex-1 text-center">
            {index % labelEvery === 0 ? format(day.date, { day: 'numeric', month: 'numeric' }) : ''}
          </span>
        ))}
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted">{t('admin.dashboard.tableView')}</summary>
        <table className={cx(TABLE, 'mt-3')}>
          <thead>
            <tr>
              <th className={TH}>{t('admin.dashboard.date')}</th>
              <th className={TH}>{t('admin.dashboard.orders')}</th>
              <th className={TH}>{t('admin.dashboard.confirmed')}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}>
                <td className={TD}>{format(day.date, { day: 'numeric', month: 'long' })}</td>
                <td className={cx(TD, 'tabular-nums')}>{day.orders}</td>
                <td className={cx(TD, 'tabular-nums')}>{day.confirmed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<number>(30)
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard', days],
    queryFn: () => dashboardApi.get(days),
    refetchInterval: 60_000,
  })

  return (
    <>
      <PageHeader
        title={t('admin.dashboard.title')}
        actions={
          <div role="group" aria-label={t('admin.dashboard.period')} className="flex gap-1">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={days === period}
                onClick={() => setDays(period)}
                className={cx(
                  'min-h-10 rounded-full px-4 text-sm',
                  days === period ? 'bg-foreground text-background' : 'text-muted hover:bg-surface',
                )}
              >
                {t('admin.dashboard.days', { count: period })}
              </button>
            ))}
          </div>
        }
      />
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile
              label={t('admin.dashboard.initiated')}
              value={data.orders.initiated}
              hint={t('admin.dashboard.initiatedHint')}
            />
            <Tile
              label={t('admin.dashboard.confirmed')}
              value={data.orders.confirmed}
              hint={t('admin.dashboard.confirmedHint')}
            />
            <Tile
              label={t('admin.dashboard.revenue')}
              value={<Money cents={parseMoney(data.orders.revenue)} />}
              hint={t('admin.dashboard.revenueHint')}
            />
            <Tile
              label={t('admin.dashboard.products')}
              value={data.products.available}
              hint={t('admin.dashboard.productsHint', {
                available: data.products.available,
                total: data.products.total,
              })}
            />
          </div>

          <Section title={t('admin.dashboard.byDate')}>
            {data.orders_by_date.some((day) => day.orders > 0) ? (
              <OrdersChart days={data.orders_by_date} />
            ) : (
              <p className="text-sm text-muted">{t('admin.dashboard.noOrders')}</p>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t('admin.dashboard.byStatus')}>
              <ul className="divide-y divide-border">
                {ORDER_STATUSES.map((status) => (
                  <li key={status} className="flex items-center justify-between py-2">
                    <Link to={`/admin/orders?status=${status}`} className="hover:opacity-80">
                      <StatusBadge status={status} />
                    </Link>
                    <span className="tabular-nums">{data.orders.by_status[status] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title={t('admin.dashboard.popular')}>
              {data.popular_products.length ? (
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th className={TH}>{t('admin.common.name')}</th>
                      <th className={TH}>{t('admin.dashboard.quantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.popular_products.map((product) => (
                      <tr key={product.product_id}>
                        <td className={TD}>
                          <Link
                            to={`/admin/products/${product.product_id}`}
                            className="hover:text-accent"
                          >
                            {product.name}
                          </Link>
                        </td>
                        <td className={cx(TD, 'tabular-nums')}>{product.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted">{t('admin.dashboard.noOrders')}</p>
              )}
            </Section>
          </div>
        </div>
      )}
    </>
  )
}
