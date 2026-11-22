import { useTranslation } from 'react-i18next'

import { useOpeningHours, useRestaurant } from '@/hooks/useCatalog'
import { cx } from '@/lib/cx'
import { restaurantWeekday, weeklySchedule } from '@/lib/hours'

/** "Open now · today 12:00–15:00, 19:00–23:30", from live API data. */
export function OpenStatus() {
  const { t } = useTranslation()
  const { data: restaurant } = useRestaurant()
  const { data: hours } = useOpeningHours()
  if (!restaurant || !hours) return <div className="h-6" />

  const today = weeklySchedule(hours)[restaurantWeekday()]

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className={cx('size-2 rounded-full', restaurant.is_open_now ? 'bg-open' : 'bg-muted')}
        />
        <span className={restaurant.is_open_now ? 'text-open' : 'text-muted'}>
          {restaurant.is_open_now ? t('home.openNow') : t('home.closedNow')}
        </span>
      </span>
      <span className="text-muted">
        {today?.slots.length ? (
          <>
            {t('home.today')} {/* Times stay left-to-right inside Arabic text. */}
            <span dir="ltr">{today.slots.join(', ')}</span>
          </>
        ) : (
          t('home.closedToday')
        )}
      </span>
    </p>
  )
}
