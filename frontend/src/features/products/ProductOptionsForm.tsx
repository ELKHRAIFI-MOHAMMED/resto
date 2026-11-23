import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Money } from '@/components/Price'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button } from '@/components/ui/Button'
import { estimateUnitPrice } from '@/features/cart/pricing'
import { useAddToCart } from '@/features/cart/useAddToCart'
import { useLanguage } from '@/hooks/useLanguage'
import { cx } from '@/lib/cx'
import { formatMoney, parseMoney } from '@/lib/money'
import { useCartStore, type CartLine, type NewCartLine } from '@/store/cart'
import { useToastStore } from '@/store/toast'
import type { ProductDetail } from '@/types/catalog'

const INSTRUCTIONS_MAX = 255

interface ProductOptionsFormProps {
  product: ProductDetail
  /** A cart line to edit: the form starts from its choices and replaces it on submit. */
  editing?: CartLine
}

/** Options of the edited line that still exist (the menu may have changed since). */
function initialChoices(product: ProductDetail, editing?: CartLine) {
  if (!editing) {
    // The first (usually smallest) size is preselected: one less tap for most orders.
    return {
      variantId: product.variants[0]?.id ?? null,
      addonIds: [],
      quantity: 1,
      instructions: '',
    }
  }
  const variantExists = product.variants.some((item) => item.id === editing.variantId)
  return {
    variantId: variantExists ? editing.variantId : null,
    addonIds: editing.addonIds.filter((addonId) => product.addons.some((a) => a.id === addonId)),
    quantity: editing.quantity,
    instructions: editing.specialInstructions,
  }
}

export function ProductOptionsForm({ product, editing }: ProductOptionsFormProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const replaceLine = useCartStore((state) => state.replaceLine)
  const showToast = useToastStore((state) => state.show)
  const id = useId()

  const [initial] = useState(() => initialChoices(product, editing))
  const [variantId, setVariantId] = useState<number | null>(initial.variantId)
  const [addonIds, setAddonIds] = useState<number[]>(initial.addonIds)
  const [quantity, setQuantity] = useState(initial.quantity)
  const [instructions, setInstructions] = useState(initial.instructions)

  const variant = product.variants.find((item) => item.id === variantId) ?? null
  const addons = product.addons.filter((addon) => addonIds.includes(addon.id))
  const needsVariant = product.variants.length > 0 && !variant
  const unitPrice = estimateUnitPrice(product, variant, addons)
  const disabled = !product.is_available || needsVariant

  const toggleAddon = (addonId: number) =>
    setAddonIds((current) =>
      current.includes(addonId)
        ? current.filter((idValue) => idValue !== addonId)
        : [...current, addonId],
    )

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (disabled) return
    const line: NewCartLine = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? '',
      addonIds: addons.map((addon) => addon.id),
      addonNames: addons.map((addon) => addon.name),
      unitPriceCents: unitPrice,
      quantity,
      specialInstructions: instructions,
    }
    if (editing) {
      replaceLine(editing.key, line)
      showToast({ message: t('cart.updated', { name: product.name }) })
      navigate('/cart')
    } else {
      addToCart(line)
    }
  }

  const optionClass = (checked: boolean) =>
    cx(
      'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
      checked ? 'border-accent bg-accent/10' : 'border-border hover:border-muted',
    )

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <fieldset disabled={!product.is_available} className="space-y-8">
        {product.variants.length > 0 && (
          <fieldset>
            <legend className="mb-3 text-sm text-muted">
              {t('product.variants')} <span className="text-xs">({t('product.required')})</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {product.variants.map((item) => {
                const delta = parseMoney(item.price_delta)
                return (
                  <label key={item.id} className={optionClass(variantId === item.id)}>
                    <input
                      type="radio"
                      name={`${id}-variant`}
                      value={item.id}
                      checked={variantId === item.id}
                      onChange={() => setVariantId(item.id)}
                      className="sr-only"
                    />
                    <span className="flex-1">{item.name}</span>
                    {delta > 0 && (
                      <bdi className="text-sm text-muted">+{formatMoney(delta, language)}</bdi>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        {product.addons.length > 0 && (
          <fieldset>
            <legend className="mb-3 text-sm text-muted">
              {t('product.addons')} <span className="text-xs">({t('product.optional')})</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {product.addons.map((addon) => {
                const checked = addonIds.includes(addon.id)
                return (
                  <label key={addon.id} className={optionClass(checked)}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAddon(addon.id)}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    <span className="flex-1">{addon.name}</span>
                    <bdi className="text-sm text-muted">
                      +{formatMoney(parseMoney(addon.price), language)}
                    </bdi>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor={`${id}-instructions`} className="mb-3 block text-sm text-muted">
            {t('product.instructions')} <span className="text-xs">({t('product.optional')})</span>
          </label>
          <textarea
            id={`${id}-instructions`}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={INSTRUCTIONS_MAX}
            rows={2}
            placeholder={t('product.instructionsPlaceholder')}
            aria-describedby={`${id}-instructions-count`}
            className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <p id={`${id}-instructions-count`} className="mt-1 text-end text-xs text-muted">
            {t('product.charactersLeft', { count: INSTRUCTIONS_MAX - instructions.length })}
          </p>
        </div>
      </fieldset>

      {!product.is_available && <p className="text-danger">{t('product.unavailable')}</p>}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <QuantityStepper value={quantity} onChange={setQuantity} label={t('product.quantity')} />
        <Button type="submit" disabled={disabled} className="grow basis-56 sm:grow-0 sm:basis-auto">
          {editing ? t('product.updateCart') : t('product.addToCart')}
          <span aria-hidden className="h-4 w-px bg-background/40" />
          <Money cents={unitPrice * quantity} />
        </Button>
      </div>
      {needsVariant && <p className="text-sm text-muted">{t('product.chooseVariant')}</p>}
      <p className="text-xs text-muted">{t('product.estimateNote')}</p>
    </form>
  )
}
