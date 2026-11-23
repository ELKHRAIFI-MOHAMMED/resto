import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'

import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { useCartQuote } from '@/features/cart/useCartQuote'
import { describeOrderError, type DescribedOrderError } from '@/features/checkout/errors'
import { OrderSummary } from '@/features/checkout/OrderSummary'
import { usePlaceOrder } from '@/features/checkout/usePlaceOrder'
import {
  NOTES_MAX_LENGTH,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutValues,
} from '@/features/checkout/validation'
import { useDeliveryZones, useRestaurant } from '@/hooks/useCatalog'
import { useLanguage } from '@/hooks/useLanguage'
import { cx } from '@/lib/cx'
import { formatMoney, parseMoney } from '@/lib/money'
import { ApiError } from '@/services/api'
import { toOrderItems } from '@/services/orders'
import { useCartStore } from '@/store/cart'
import type { OrderType } from '@/types/orders'

export function CheckoutPage() {
  const { t } = useTranslation()
  const language = useLanguage()
  const lines = useCartStore((state) => state.lines)
  const { data: restaurant } = useRestaurant()
  const { data: zones } = useDeliveryZones()
  const { placeOrder, isPending: isSubmitting, isSuccess: isPlaced } = usePlaceOrder()

  const [values, setValues] = useState<CheckoutValues>({
    customerName: '',
    customerPhone: '',
    orderType: null,
    deliveryZone: null,
    deliveryAddress: '',
    city: '',
    notes: '',
  })
  const [errors, setErrors] = useState<CheckoutErrors>({})
  const [submitError, setSubmitError] = useState<DescribedOrderError | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)

  // Offer only the order types the restaurant has enabled; preselect if only one.
  const orderTypes: OrderType[] = []
  if (restaurant?.delivery_enabled) orderTypes.push('delivery')
  if (restaurant?.pickup_enabled) orderTypes.push('pickup')
  const onlyType = orderTypes.length === 1 ? orderTypes[0] : undefined
  const [cityEdited, setCityEdited] = useState(false)

  // Defaults are derived, not copied into state: the single available order
  // type is preselected and the city starts as the restaurant's city.
  const form: CheckoutValues = {
    ...values,
    orderType: values.orderType ?? onlyType ?? null,
    city: cityEdited ? values.city : values.city || restaurant?.city || '',
  }

  const {
    quote,
    error: quoteError,
    isPending: isQuoting,
    lineIssues,
  } = useCartQuote({
    orderType: form.orderType,
    deliveryZone: form.deliveryZone,
  })
  // A quote problem (unavailable dish, minimum not met…) blocks the order
  // until fixed; a network hiccup does not.
  const quoteProblem =
    quoteError && !(quoteError instanceof ApiError && quoteError.code === 'network_error')
      ? describeOrderError(quoteError, t, language).message
      : null
  const hasLineIssues = Object.keys(lineIssues).length > 0

  // Move focus to the first invalid field after a failed submit.
  useEffect(() => {
    if (!focusRequest) return
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [focusRequest])

  // After a successful order the cart is emptied while we navigate away: no redirect then.
  if (lines.length === 0 && !isPlaced) return <Navigate to="/cart" replace />

  const update = <K extends keyof CheckoutValues>(field: K, value: CheckoutValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
  }

  const errorText = (field: keyof CheckoutValues) => {
    const key = errors[field]
    return key ? t(`checkout.errors.${key}`) : undefined
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return
    const found = validateCheckout(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setFocusRequest((count) => count + 1)
      return
    }
    setSubmitError(null)
    const isDelivery = form.orderType === 'delivery'
    placeOrder(
      {
        order_type: form.orderType as OrderType,
        delivery_zone: isDelivery ? form.deliveryZone : null,
        customer_name: form.customerName.trim(),
        customer_phone: form.customerPhone.trim(),
        delivery_address: isDelivery ? form.deliveryAddress.trim() : '',
        city: form.city.trim(),
        customer_notes: form.notes.trim(),
        items: toOrderItems(lines),
      },
      {
        onError: (error) => {
          const described = describeOrderError(error, t, language)
          setSubmitError(described)
          if (Object.keys(described.fieldErrors).length) {
            setErrors((current) => ({ ...current, ...described.fieldErrors }))
            setFocusRequest((count) => count + 1)
          }
        },
      },
    )
  }

  const notAccepting = Boolean(restaurant && !restaurant.is_accepting_orders)
  const problem = notAccepting
    ? t('checkout.errors.orderingClosed')
    : (submitError?.message ?? quoteProblem)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-12 pb-24 sm:px-6 sm:pt-16">
      <title>{`${t('checkout.title')} | ${t('brand.name')}`}</title>
      <meta name="description" content={t('checkout.metaDescription')} />
      <meta name="robots" content="noindex" />

      <h1 className="font-display text-5xl sm:text-6xl">{t('checkout.title')}</h1>

      {restaurant && !restaurant.is_open_now && restaurant.is_accepting_orders && (
        <p
          role="status"
          className="mt-6 max-w-prose rounded-xl border border-border px-4 py-3 text-sm text-muted"
        >
          {t('checkout.closedNotice')}
        </p>
      )}

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <form
          noValidate
          onSubmit={onSubmit}
          className="space-y-12"
          aria-describedby="checkout-whatsapp-note"
        >
          <fieldset className="space-y-5">
            <legend className="mb-5 font-display text-3xl">{t('checkout.contactTitle')}</legend>
            <TextField
              label={t('checkout.name')}
              autoComplete="name"
              maxLength={120}
              value={form.customerName}
              onChange={(event) => update('customerName', event.target.value)}
              error={errorText('customerName')}
            />
            <TextField
              label={t('checkout.phone')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={30}
              placeholder="06 12 34 56 78"
              value={form.customerPhone}
              onChange={(event) => update('customerPhone', event.target.value)}
              hint={t('checkout.phoneHint')}
              error={errorText('customerPhone')}
            />
          </fieldset>

          <fieldset aria-describedby={errors.orderType ? 'order-type-error' : undefined}>
            <legend className="mb-5 font-display text-3xl">{t('checkout.orderTypeTitle')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {orderTypes.map((type) => {
                const checked = form.orderType === type
                return (
                  <label
                    key={type}
                    className={cx(
                      'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                      checked ? 'border-accent bg-accent/10' : 'border-border hover:border-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="order-type"
                      value={type}
                      checked={checked}
                      onChange={() => update('orderType', type)}
                      aria-invalid={Boolean(errors.orderType)}
                      className="mt-1 accent-[var(--color-accent)]"
                    />
                    <span>
                      <span className="block font-medium">{t(`checkout.${type}`)}</span>
                      <span className="block text-sm text-muted">{t(`checkout.${type}Hint`)}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            {errors.orderType && (
              <p id="order-type-error" className="mt-2 text-sm text-danger">
                {errorText('orderType')}
              </p>
            )}
          </fieldset>

          {form.orderType === 'delivery' && (
            <fieldset className="space-y-5">
              <legend className="mb-5 font-display text-3xl">{t('checkout.addressTitle')}</legend>
              <SelectField
                label={t('checkout.zone')}
                value={form.deliveryZone ?? ''}
                onChange={(event) =>
                  update('deliveryZone', event.target.value ? Number(event.target.value) : null)
                }
                error={errorText('deliveryZone')}
              >
                <option value="">{t('checkout.zonePlaceholder')}</option>
                {zones?.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {t('checkout.zoneOption', {
                      name: zone.name,
                      fee: formatMoney(parseMoney(zone.delivery_fee), language),
                    })}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t('checkout.address')}
                autoComplete="street-address"
                maxLength={255}
                placeholder={t('checkout.addressPlaceholder')}
                value={form.deliveryAddress}
                onChange={(event) => update('deliveryAddress', event.target.value)}
                error={errorText('deliveryAddress')}
              />
              <TextField
                label={t('checkout.city')}
                autoComplete="address-level2"
                maxLength={100}
                value={form.city}
                onChange={(event) => {
                  setCityEdited(true)
                  update('city', event.target.value)
                }}
                error={errorText('city')}
              />
            </fieldset>
          )}

          <TextAreaField
            label={t('checkout.notes')}
            optionalLabel={t('checkout.optional')}
            rows={3}
            maxLength={NOTES_MAX_LENGTH}
            placeholder={t('checkout.notesPlaceholder')}
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            error={errorText('notes')}
          />

          <div className="space-y-4 border-t border-border pt-8">
            {problem && (
              <p
                role="alert"
                className="rounded-xl border border-danger/50 px-4 py-3 text-sm text-danger"
              >
                {problem}
                {hasLineIssues && (
                  <>
                    {' '}
                    <Link to="/cart" className="underline underline-offset-4 hover:text-foreground">
                      {t('checkout.editCart')}
                    </Link>
                  </>
                )}
              </p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || notAccepting || Boolean(quoteProblem)}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? t('checkout.submitting') : t('checkout.submit')}
            </Button>
            <p id="checkout-whatsapp-note" className="max-w-prose text-sm text-muted">
              {t('checkout.whatsappNote')}
            </p>
          </div>
        </form>

        <OrderSummary
          lines={lines}
          quote={quote}
          isPending={isQuoting}
          orderType={form.orderType}
          hasZone={Boolean(form.deliveryZone)}
        />
      </div>
    </div>
  )
}
