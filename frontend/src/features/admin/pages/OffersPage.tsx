import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Money } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { ButtonLink } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'

import { offersApi, type AdminOffer } from '../api'
import { TABLE, TD, TH } from '../helpers'
import { FormError, PageHeader } from '../ui'

/** Offers (packs): a fixed price for dishes the customer picks in each group. */
export function OffersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const offers = useQuery({ queryKey: ['admin', 'offers'], queryFn: offersApi.list })
  const toggle = useMutation({
    mutationFn: (offer: AdminOffer) => offersApi.update(offer.id, { is_active: !offer.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'offers'] }),
  })

  const period = (offer: AdminOffer) => {
    if (offer.starts_on && offer.ends_on)
      return t('admin.offers.periodRange', { from: offer.starts_on, to: offer.ends_on })
    if (offer.starts_on) return t('admin.offers.periodFrom', { from: offer.starts_on })
    if (offer.ends_on) return t('admin.offers.periodUntil', { to: offer.ends_on })
    return t('admin.offers.periodAlways')
  }

  return (
    <>
      <PageHeader
        title={t('admin.offers.title')}
        actions={
          <ButtonLink to="/admin/offers/new">
            <Plus aria-hidden className="size-4" />
            {t('admin.offers.new')}
          </ButtonLink>
        }
      />
      <p className="mb-6 max-w-prose text-sm text-muted">{t('admin.offers.intro')}</p>
      <FormError error={toggle.error} />

      {offers.isPending ? (
        <Skeleton className="h-64" />
      ) : offers.isError ? (
        <ErrorState error={offers.error} onRetry={() => void offers.refetch()} />
      ) : offers.data.length === 0 ? (
        <p className="rounded-2xl border border-border p-6 text-sm text-muted">
          {t('admin.offers.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>{t('admin.common.name')}</th>
                <th className={TH}>{t('admin.offers.rules')}</th>
                <th className={TH}>{t('admin.common.price')}</th>
                <th className={TH}>{t('admin.offers.period')}</th>
                <th className={TH}>{t('admin.common.active')}</th>
              </tr>
            </thead>
            <tbody>
              {offers.data.map((offer) => (
                <tr key={offer.id} className={cx(!offer.is_active && 'opacity-60')}>
                  <td className={TD}>
                    <Link
                      to={`/admin/offers/${offer.id}`}
                      className="flex items-center gap-3 hover:text-accent"
                    >
                      <ProductImage
                        src={offer.image}
                        alt=""
                        className="size-10 shrink-0 rounded-lg"
                      />
                      <span className="font-medium">{offer.name_fr}</span>
                    </Link>
                  </td>
                  <td className={cx(TD, 'text-muted')}>
                    {offer.groups
                      .map((group) =>
                        t('admin.offers.groupRule', { count: group.quantity, name: group.name_fr }),
                      )
                      .join(' · ')}
                  </td>
                  <td className={TD}>
                    <Money cents={parseMoney(offer.price)} />
                  </td>
                  <td className={cx(TD, 'whitespace-nowrap text-muted')}>{period(offer)}</td>
                  <td className={TD}>
                    <input
                      type="checkbox"
                      checked={offer.is_active}
                      disabled={toggle.isPending}
                      onChange={() => toggle.mutate(offer)}
                      aria-label={`${t('admin.common.active')}: ${offer.name_fr}`}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
