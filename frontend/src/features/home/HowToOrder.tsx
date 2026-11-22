import { useTranslation } from 'react-i18next'

import { useDeliveryZones, useRestaurant } from '@/hooks/useCatalog'
import { useLanguage } from '@/hooks/useLanguage'
import { formatMoney, parseMoney } from '@/lib/money'

/**
 * The ordering flow, stated honestly: the customer sends the WhatsApp message
 * and the restaurant confirms. Numbered because it is a real sequence.
 */
export function HowToOrder() {
  const { t } = useTranslation()
  const language = useLanguage()
  const { data: restaurant } = useRestaurant()
  const { data: zones } = useDeliveryZones()

  const steps = [
    { title: t('home.step1Title'), text: t('home.step1Text') },
    { title: t('home.step2Title'), text: t('home.step2Text') },
    { title: t('home.step3Title'), text: t('home.step3Text') },
  ]

  const facts: string[] = []
  if (restaurant?.delivery_enabled && zones?.length) {
    facts.push(t('home.deliveryZones', { count: zones.length }))
    if (restaurant.free_delivery_threshold) {
      facts.push(
        t('home.freeDelivery', {
          amount: formatMoney(parseMoney(restaurant.free_delivery_threshold), language),
        }),
      )
    }
    if (parseMoney(restaurant.minimum_order_amount) > 0) {
      facts.push(
        t('home.minimumOrder', {
          amount: formatMoney(parseMoney(restaurant.minimum_order_amount), language),
        }),
      )
    }
  }
  if (restaurant?.pickup_enabled) facts.push(t('home.pickup'))

  return (
    <section aria-labelledby="steps-title" className="border-y border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 id="steps-title" className="font-display text-4xl sm:text-5xl">
          {t('home.stepsTitle')}
        </h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-5">
              <span aria-hidden className="font-display text-5xl leading-none text-accent">
                {index + 1}
              </span>
              <div>
                <h3 className="text-xl font-medium">{step.title}</h3>
                <p className="mt-2 text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        {facts.length > 0 && (
          <ul className="mt-14 flex flex-wrap gap-x-10 gap-y-3 border-t border-border pt-8 text-sm text-foreground">
            {facts.map((fact) => (
              <li key={fact}>
                <bdi>{fact}</bdi>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
