import { Copy, MessageCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'

import { OfferChoices } from '@/components/OfferChoices'
import { Money } from '@/components/Price'
import { Button, ButtonLink } from '@/components/ui/Button'
import { buttonClassName } from '@/components/ui/buttonClassName'
import { EmptyState } from '@/components/ui/StateMessage'
import type { OrderPageState } from '@/features/checkout/usePlaceOrder'
import { buildWhatsAppUrl } from '@/features/checkout/whatsapp'
import { useRestaurant } from '@/hooks/useCatalog'
import { parseMoney } from '@/lib/money'
import { summarizeChoices } from '@/lib/offers'
import { useLastOrderStore } from '@/store/lastOrder'
import { useToastStore } from '@/store/toast'

/**
 * The WhatsApp hand-off. The order is saved but NOT sent: the customer must
 * press Send in WhatsApp. This page never claims otherwise, keeps the
 * reference, and offers to reopen WhatsApp or copy the message.
 */
export function OrderPage() {
  const { reference = '' } = useParams()
  const { t } = useTranslation()
  const location = useLocation()
  const order = useLastOrderStore((state) => state.order)
  const handoffStarted = useLastOrderStore((state) => state.handoffStarted)
  const markHandoffStarted = useLastOrderStore((state) => state.markHandoffStarted)
  const showToast = useToastStore((state) => state.show)
  const { data: restaurant } = useRestaurant()
  const autoOpened = useRef(false)

  const matches = order?.reference === reference
  const whatsappUrl = matches
    ? buildWhatsAppUrl(order.whatsapp.phone, order.whatsapp.message)
    : null

  // Phones: hand off in this tab right after checkout (once, never on reload).
  const autoOpen = (location.state as OrderPageState | null)?.autoOpen
  useEffect(() => {
    if (!autoOpen || !whatsappUrl || handoffStarted || autoOpened.current) return
    autoOpened.current = true
    markHandoffStarted()
    window.location.assign(whatsappUrl)
  }, [autoOpen, whatsappUrl, handoffStarted, markHandoffStarted])

  if (!matches || !whatsappUrl) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <title>{`${t('order.notFoundTitle')} | ${t('brand.name')}`}</title>
        <meta name="robots" content="noindex" />
        <EmptyState
          title={t('order.notFoundTitle')}
          hint={t('order.notFoundText')}
          action={
            restaurant?.whatsapp_number ? (
              <a
                href={`https://wa.me/${restaurant.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName('secondary')}
              >
                {t('order.contact')}
              </a>
            ) : (
              <ButtonLink to="/menu">{t('order.backToMenu')}</ButtonLink>
            )
          }
        />
      </div>
    )
  }

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(order.whatsapp.message)
      showToast({ message: t('order.copied') })
    } catch {
      // Clipboard unavailable (old browser, permissions): the message stays
      // visible below for manual copying.
      document.getElementById('whatsapp-message')?.closest('details')?.setAttribute('open', '')
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
      <title>{`${t('order.metaTitle', { reference })} | ${t('brand.name')}`}</title>
      <meta name="robots" content="noindex" />

      <h1 className="font-display text-5xl text-balance sm:text-6xl">{t('order.title')}</h1>

      <p className="mt-8 text-muted">{t('order.saved')}</p>
      <p className="mt-1 font-display text-4xl tracking-wide text-accent">
        {/* Isolated LTR run: aligned with the page, read left to right. */}
        <bdi dir="ltr">{order.reference}</bdi>
      </p>

      <p className="mt-8 max-w-prose text-lg">{t('order.instructions')}</p>
      <p className="mt-3 max-w-prose text-sm text-muted">{t('order.notSentYet')}</p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markHandoffStarted}
          className={buttonClassName('primary')}
        >
          <MessageCircle aria-hidden className="size-5" />
          {handoffStarted ? t('order.reopen') : t('order.open')}
        </a>
        <Button variant="secondary" onClick={() => void copyMessage()}>
          <Copy aria-hidden className="size-4" />
          {t('order.copy')}
        </Button>
      </div>

      <p className="mt-6 text-sm text-muted">
        {t('order.fallback')} <bdi dir="ltr">+{order.whatsapp.phone}</bdi>.
      </p>

      <details className="mt-6 rounded-xl border border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm">{t('order.messagePreview')}</summary>
        <pre
          id="whatsapp-message"
          dir="auto"
          className="overflow-x-auto px-4 pb-4 font-sans text-sm whitespace-pre-wrap text-muted"
        >
          {order.whatsapp.message}
        </pre>
      </details>

      <section aria-labelledby="order-summary-title" className="mt-14 border-t border-border pt-10">
        <h2 id="order-summary-title" className="font-display text-3xl">
          {t('order.summaryTitle')}
        </h2>
        <ul className="mt-6 space-y-3 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span className="text-muted tabular-nums">{item.quantity}×</span>
              <span className="flex-1">
                {item.product_name}
                {(item.variant_name || item.addons.length > 0) && (
                  <span className="block text-xs text-muted">
                    {[item.variant_name, ...item.addons.map((addon) => `+ ${addon.addon_name}`)]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                )}
                <OfferChoices summary={summarizeChoices(item.choices)} className="text-xs" />
              </span>
              <Money cents={parseMoney(item.line_total)} />
            </li>
          ))}
        </ul>
        <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t('checkout.subtotal')}</dt>
            <dd>
              <Money cents={parseMoney(order.subtotal)} />
            </dd>
          </div>
          {order.order_type === 'delivery' && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t('checkout.delivery_fee')}</dt>
              <dd>
                {parseMoney(order.delivery_fee) === 0 ? (
                  t('checkout.deliveryFree')
                ) : (
                  <Money cents={parseMoney(order.delivery_fee)} />
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-border pt-3 text-lg">
            <dt>{t('checkout.total')}</dt>
            <dd className="text-accent">
              <Money cents={parseMoney(order.total)} />
            </dd>
          </div>
        </dl>
        <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">{t('order.customer')}</dt>
            <dd className="mt-1">
              {order.customer_name}
              <span className="block">
                <bdi dir="ltr">{order.customer_phone}</bdi>
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted">
              {order.order_type === 'delivery' ? t('order.deliveryTo') : t('order.pickupAt')}
            </dt>
            {order.order_type === 'delivery' && (
              <dd className="mt-1">
                {order.delivery_address}, {order.city}
                {order.delivery_zone_name && (
                  <span className="block text-muted">{order.delivery_zone_name}</span>
                )}
              </dd>
            )}
          </div>
          {order.customer_notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted">{t('order.notes')}</dt>
              <dd className="mt-1">{order.customer_notes}</dd>
            </div>
          )}
        </dl>
        <div className="mt-10">
          <Link
            to="/menu"
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            {t('order.backToMenu')}
          </Link>
        </div>
      </section>
    </div>
  )
}
