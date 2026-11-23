import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Money } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { useOffers } from '@/hooks/useCatalog'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'

/** Current offers (packs) as cards; renders nothing when there are none. */
export function OffersSection({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { data: offers } = useOffers()
  if (!offers?.length) return null

  return (
    <section aria-labelledby="offers-title" className={className}>
      <h2 id="offers-title" className="font-display text-4xl sm:text-5xl">
        {t('offers.title')}
      </h2>
      <p className="mt-2 text-muted">{t('offers.intro')}</p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <li key={offer.id}>
            <Link
              to={`/offres/${offer.slug}`}
              className={cx(
                'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-accent',
                !offer.is_available && 'opacity-60',
              )}
            >
              <ProductImage
                src={offer.image}
                alt=""
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="aspect-[16/10] w-full"
              />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-baseline gap-3">
                  <h3 className="flex-1 font-display text-2xl group-hover:text-accent">
                    {offer.name}
                  </h3>
                  <Money cents={parseMoney(offer.price)} className="text-lg text-accent" />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {offer.groups
                    .map((group) =>
                      t('offers.groupSummary', { count: group.quantity, group: group.name }),
                    )
                    .join(' · ')}
                </p>
                <span className="mt-auto pt-4 text-sm text-accent underline-offset-4 group-hover:underline">
                  {offer.is_available ? t('offers.compose') : t('offers.unavailableOffer')}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
