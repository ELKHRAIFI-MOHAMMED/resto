import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'

import { FeaturedDishes } from '@/features/home/FeaturedDishes'
import { Gallery } from '@/features/home/Gallery'
import { Hero } from '@/features/home/Hero'
import { HowToOrder } from '@/features/home/HowToOrder'
import { MenuBoard } from '@/features/home/MenuBoard'
import { VisitUs } from '@/features/home/VisitUs'
import { useOpeningHours, useRestaurant } from '@/hooks/useCatalog'
import { restaurantStructuredData } from '@/lib/structuredData'

export function HomePage() {
  const { t } = useTranslation()
  const { hash } = useLocation()
  const { data: restaurant } = useRestaurant()
  const { data: hours } = useOpeningHours()
  const name = restaurant?.name ?? t('brand.name')

  // React Router does not scroll to #anchors by itself.
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(hash.slice(1))
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, restaurant])

  return (
    <>
      <title>{`${name} | ${t('brand.tagline')}`}</title>
      <meta name="description" content={t('home.metaDescription')} />
      <meta property="og:title" content={name} />
      <meta property="og:description" content={t('home.metaDescription')} />
      <meta property="og:type" content="restaurant" />
      {restaurant && hours && (
        <script type="application/ld+json">
          {JSON.stringify(restaurantStructuredData(restaurant, hours, window.location.origin))}
        </script>
      )}

      <Hero />
      <FeaturedDishes />
      <MenuBoard />
      <HowToOrder />
      <Gallery />
      <VisitUs />
    </>
  )
}
