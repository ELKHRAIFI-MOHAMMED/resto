import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useCategories, useRestaurant } from '@/hooks/useCatalog'

/** The categories as a printed menu board: name, dotted leader, number of dishes. */
export function MenuBoard() {
  const { t } = useTranslation()
  const { data: restaurant } = useRestaurant()
  const { data: categories, isPending, isError, error, refetch } = useCategories()

  return (
    <section
      aria-labelledby="menu-board-title"
      className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20"
    >
      <div>
        <h2 id="menu-board-title" className="font-display text-4xl sm:text-5xl">
          {t('home.menuTitle')}
        </h2>
        {restaurant?.description && (
          <p className="mt-6 max-w-prose text-lg text-muted">{restaurant.description}</p>
        )}
        <p className="mt-4 text-muted">{t('home.menuText')}</p>
      </div>

      {isPending ? (
        <div className="space-y-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <ul className="border-t border-border">
          {categories.map((category) => (
            <li key={category.id} className="border-b border-border">
              <Link
                to={`/menu?category=${category.slug}`}
                className="group flex items-baseline py-5"
              >
                <span className="font-display text-3xl transition-colors group-hover:text-accent sm:text-4xl">
                  {category.name}
                </span>
                <span aria-hidden className="leader" />
                <span className="text-sm text-muted">
                  {t('home.dishCount', { count: category.product_count })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
