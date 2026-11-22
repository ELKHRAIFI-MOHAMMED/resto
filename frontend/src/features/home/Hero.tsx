import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ArchImage } from '@/components/ArchImage'
import { Price } from '@/components/Price'
import { ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/StateMessage'
import { useProducts, useRestaurant } from '@/hooks/useCatalog'

import { OpenStatus } from './OpenStatus'

export function Hero() {
  const { t } = useTranslation()
  const { data: restaurant } = useRestaurant()
  const { data: featured, isPending } = useProducts({ featured: true })
  const signature = featured?.find((product) => product.image) ?? featured?.[0]

  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-20 lg:pt-16 lg:pb-28">
      <div className="motion-safe:animate-rise">
        <OpenStatus />
        <h1 className="mt-8 font-display text-5xl text-balance sm:text-6xl lg:text-[5.5rem] lg:leading-[0.98]">
          {t('home.heroTitle')}
        </h1>
        <p className="mt-8 max-w-[34rem] text-lg text-muted">{t('home.heroText')}</p>
        {restaurant && !restaurant.is_accepting_orders && (
          <p className="mt-6 text-danger">{t('home.notAcceptingOrders')}</p>
        )}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <ButtonLink to="/menu">{t('home.orderNow')}</ButtonLink>
          <Link
            to={{ pathname: '/', hash: 'infos' }}
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            {t('home.infoTitle')}
          </Link>
        </div>
      </div>

      <figure className="mx-auto w-full max-w-sm lg:max-w-none">
        {isPending ? (
          <Skeleton className="arch aspect-[4/5] w-full" />
        ) : (
          <ArchImage src={signature?.image ?? null} alt={signature?.name ?? ''} priority reveal />
        )}
        {signature && (
          <figcaption className="mt-6 flex items-baseline justify-between gap-4 text-sm">
            <Link to={`/menu/${signature.slug}`} className="text-foreground hover:text-accent">
              {signature.name}
            </Link>
            <Price
              amount={signature.effective_price}
              original={signature.is_on_sale ? signature.price : null}
            />
          </figcaption>
        )}
      </figure>
    </section>
  )
}
