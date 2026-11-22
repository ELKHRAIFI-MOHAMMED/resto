import { useTranslation } from 'react-i18next'

import { ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useOpeningHours, useRestaurant } from '@/hooks/useCatalog'
import { useLanguage } from '@/hooks/useLanguage'
import { cx } from '@/lib/cx'
import { restaurantWeekday, weekdayName, weeklySchedule } from '@/lib/hours'

export function VisitUs() {
  const { t } = useTranslation()
  const language = useLanguage()
  const restaurant = useRestaurant()
  const hours = useOpeningHours()
  const today = restaurantWeekday()

  const linkClass = 'text-accent underline-offset-4 hover:underline'
  const data = restaurant.data
  const socials = data
    ? [
        { label: 'Instagram', href: data.instagram_url },
        { label: 'Facebook', href: data.facebook_url },
        { label: 'TikTok', href: data.tiktok_url },
      ].filter((social) => social.href)
    : []

  return (
    <section
      id="infos"
      aria-labelledby="infos-title"
      className="scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <h2 id="infos-title" className="sr-only">
          {t('home.infoTitle')}
        </h2>

        <div>
          <h3 className="font-display text-4xl">{t('home.hoursTitle')}</h3>
          {hours.isPending ? (
            <Skeleton className="mt-8 h-64 w-full" />
          ) : hours.isError ? (
            <ErrorState error={hours.error} onRetry={() => void hours.refetch()} />
          ) : (
            <dl className="mt-8 divide-y divide-border border-y border-border">
              {weeklySchedule(hours.data).map((day) => (
                <div
                  key={day.weekday}
                  className={cx(
                    'flex justify-between gap-6 py-3',
                    day.weekday === today && 'text-accent',
                  )}
                >
                  <dt className="capitalize">
                    {weekdayName(day.weekday, language)}
                    {day.weekday === today && <span className="sr-only"> ({t('home.today')})</span>}
                  </dt>
                  <dd
                    className={cx('text-end tabular-nums', day.weekday !== today && 'text-muted')}
                  >
                    {day.slots.length ? (
                      <span dir="ltr">{day.slots.join(', ')}</span>
                    ) : (
                      t('home.closed')
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div>
          <h3 className="font-display text-4xl">{t('home.contactTitle')}</h3>
          {restaurant.isPending ? (
            <Skeleton className="mt-8 h-40 w-full" />
          ) : restaurant.isError ? (
            <ErrorState error={restaurant.error} onRetry={() => void restaurant.refetch()} />
          ) : (
            <div className="mt-8 space-y-8">
              <address className="text-lg not-italic">
                {data?.address}
                {data?.city && <span className="block text-muted">{data.city}</span>}
              </address>
              <ul className="space-y-3">
                {data?.phone && (
                  <li>
                    <a href={`tel:${data.phone}`} className={linkClass}>
                      {t('home.call')} <bdi dir="ltr">{data.phone}</bdi>
                    </a>
                  </li>
                )}
                {data?.whatsapp_number && (
                  <li>
                    <a
                      href={`https://wa.me/${data.whatsapp_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {t('home.whatsapp')}
                    </a>
                  </li>
                )}
                {data?.email && (
                  <li>
                    <a href={`mailto:${data.email}`} className={linkClass}>
                      {data.email}
                    </a>
                  </li>
                )}
                {data?.google_maps_url && (
                  <li>
                    <a
                      href={data.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {t('home.directions')}
                    </a>
                  </li>
                )}
              </ul>
              {socials.length > 0 && (
                <div>
                  <p className="text-sm text-muted">{t('home.socialTitle')}</p>
                  <ul className="mt-2 flex gap-5">
                    {socials.map((social) => (
                      <li key={social.label}>
                        <a
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {social.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
