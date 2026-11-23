import { Minus, Plus } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import { ArchImage } from '@/components/ArchImage'
import { Money } from '@/components/Price'
import { ProductImage } from '@/components/ProductImage'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateMessage'
import { useAddToCart } from '@/features/cart/useAddToCart'
import { useOffer } from '@/hooks/useCatalog'
import { cx } from '@/lib/cx'
import { parseMoney } from '@/lib/money'
import { ApiError } from '@/services/api'
import { useCartStore, type CartLine, type CartOfferChoice, type NewCartLine } from '@/store/cart'
import { useToastStore } from '@/store/toast'
import type { Offer, OfferGroup, OfferProduct } from '@/types/catalog'

const INSTRUCTIONS_MAX = 255

/** groupId → productId → how many times it was picked */
type Picks = Record<number, Record<number, number>>

export function OfferPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const { data: offer, isPending, isError, error, refetch } = useOffer(slug)

  if (isPending) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[5fr_6fr]">
        <Skeleton className="arch aspect-[4/5] w-full max-w-md" />
        <div className="space-y-4">
          <Skeleton className="h-14 w-3/4" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
  if (isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        {error instanceof ApiError && error.status === 404 ? (
          <>
            <title>{`${t('offers.notFoundTitle')} | ${t('brand.name')}`}</title>
            <meta name="robots" content="noindex" />
            <EmptyState
              title={t('offers.notFoundTitle')}
              hint={t('offers.notFoundText')}
              action={<ButtonLink to="/menu">{t('menu.title')}</ButtonLink>}
            />
          </>
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }
  return <OfferView key={offer.id} offer={offer} />
}

function OfferView({ offer }: { offer: Offer }) {
  const { t } = useTranslation()
  // `?edit=<line key>` opens the offer on a cart line, to change the dishes picked.
  const [searchParams] = useSearchParams()
  const editKey = searchParams.get('edit')
  const editing = useCartStore((state) =>
    editKey
      ? state.lines.find((line) => line.key === editKey && line.offerId === offer.id)
      : undefined,
  )
  const description = offer.description || t('offers.metaFallback', { name: offer.name })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <title>{`${offer.name} | ${t('brand.name')}`}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={offer.name} />
      <meta property="og:description" content={description} />
      {offer.image && <meta property="og:image" content={offer.image} />}

      <nav aria-label={t('nav.breadcrumb')} className="mb-10 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link to="/menu" className="hover:text-foreground">
              {t('menu.title')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>{t('offers.title')}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <div className="mx-auto w-full max-w-sm lg:sticky lg:top-24 lg:h-fit lg:max-w-none">
          <ArchImage src={offer.image} alt={offer.name} priority />
        </div>
        <div>
          <p className="text-sm tracking-[0.2em] text-accent uppercase">{t('offers.badge')}</p>
          <h1 className="mt-2 font-display text-5xl sm:text-6xl">{offer.name}</h1>
          <p className="mt-4 text-2xl text-accent">
            <Money cents={parseMoney(offer.price)} />
          </p>
          {offer.description && (
            <p className="mt-6 max-w-prose text-lg text-muted">{offer.description}</p>
          )}
          {editing && (
            <p
              role="status"
              className="mt-8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-accent/40 px-4 py-3 text-sm"
            >
              {t('product.editing')}
              <Link
                to="/cart"
                className="text-muted underline underline-offset-4 hover:text-foreground"
              >
                {t('product.cancelEdit')}
              </Link>
            </p>
          )}
          <div className="mt-10">
            <OfferForm key={editing?.key ?? 'new'} offer={offer} editing={editing} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Picks of the edited line that are still possible (the offer may have changed). */
function initialPicks(offer: Offer, editing?: CartLine): Picks {
  const picks: Picks = {}
  for (const group of offer.groups) {
    picks[group.id] = {}
    const previous = editing?.choices?.find((choice) => choice.groupId === group.id)
    let room = group.quantity
    for (const pick of previous?.picks ?? []) {
      const product = group.products.find((item) => item.id === pick.productId)
      if (!product?.is_available || room <= 0) continue
      const count = Math.min(pick.quantity, room)
      picks[group.id] = { ...picks[group.id], [product.id]: count }
      room -= count
    }
  }
  return picks
}

const countOf = (counts: Record<number, number> = {}) =>
  Object.values(counts).reduce((sum, value) => sum + value, 0)

/** Name as written on the order: with the size served, like the backend snapshot. */
const pickName = (product: OfferProduct) =>
  product.variant_name ? `${product.name} (${product.variant_name})` : product.name

function OfferForm({ offer, editing }: { offer: Offer; editing?: CartLine }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const replaceLine = useCartStore((state) => state.replaceLine)
  const showToast = useToastStore((state) => state.show)
  const id = useId()

  const [picks, setPicks] = useState<Picks>(() => initialPicks(offer, editing))
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1)
  const [instructions, setInstructions] = useState(editing?.specialInstructions ?? '')

  const missing = offer.groups.find((group) => countOf(picks[group.id]) < group.quantity)
  const unitPrice = parseMoney(offer.price)
  const disabled = !offer.is_available || Boolean(missing)

  const change = (group: OfferGroup, productId: number, delta: number) =>
    setPicks((current) => {
      const counts = { ...current[group.id] }
      const next = (counts[productId] ?? 0) + delta
      if (next < 0 || (delta > 0 && countOf(counts) >= group.quantity)) return current
      return { ...current, [group.id]: { ...counts, [productId]: next } }
    })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (disabled) return
    const choices: CartOfferChoice[] = offer.groups.map((group) => ({
      groupId: group.id,
      groupName: group.name,
      // In the group's display order, like the backend quote.
      picks: group.products
        .filter((product) => picks[group.id]?.[product.id])
        .map((product) => ({
          productId: product.id,
          name: pickName(product),
          quantity: picks[group.id]?.[product.id] ?? 0,
        })),
    }))
    const line: NewCartLine = {
      productId: null,
      offerId: offer.id,
      choices,
      slug: offer.slug,
      name: offer.name,
      image: offer.image,
      variantId: null,
      variantName: '',
      addonIds: [],
      addonNames: [],
      unitPriceCents: unitPrice,
      quantity,
      specialInstructions: instructions,
    }
    if (editing) {
      replaceLine(editing.key, line)
      showToast({ message: t('cart.updated', { name: offer.name }) })
      navigate('/cart')
    } else {
      addToCart(line)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {offer.groups.map((group) => (
        <GroupPicker
          key={group.id}
          group={group}
          counts={picks[group.id] ?? {}}
          onChange={(productId, delta) => change(group, productId, delta)}
        />
      ))}

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
          className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {!offer.is_available && <p className="text-danger">{t('offers.unavailableOffer')}</p>}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <QuantityStepper value={quantity} onChange={setQuantity} label={t('product.quantity')} />
        <Button type="submit" disabled={disabled} className="grow basis-56 sm:grow-0 sm:basis-auto">
          {editing ? t('product.updateCart') : t('product.addToCart')}
          <span aria-hidden className="h-4 w-px bg-background/40" />
          <Money cents={unitPrice * quantity} />
        </Button>
      </div>
      {missing && offer.is_available && (
        <p className="text-sm text-muted">
          {t('offers.remaining', {
            count: missing.quantity - countOf(picks[missing.id]),
            group: missing.name,
          })}
        </p>
      )}
    </form>
  )
}

function GroupPicker({
  group,
  counts,
  onChange,
}: {
  group: OfferGroup
  counts: Record<number, number>
  onChange: (productId: number, delta: number) => void
}) {
  const { t } = useTranslation()
  const headingId = useId()
  const chosen = countOf(counts)
  const full = chosen >= group.quantity

  return (
    <section role="group" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3">
        <h2 id={headingId} className="font-display text-3xl">
          {group.name}
        </h2>
        <p
          aria-live="polite"
          className={cx('text-sm tabular-nums', full ? 'text-accent' : 'text-muted')}
        >
          {t('offers.progress', { chosen, count: group.quantity })}
        </p>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {group.products.map((product) => {
          const count = counts[product.id] ?? 0
          return (
            <li
              key={product.id}
              className={cx(
                'flex items-center gap-3 rounded-xl border p-2 pe-3 transition-colors',
                count > 0 ? 'border-accent bg-accent/10' : 'border-border',
                !product.is_available && 'opacity-60',
              )}
            >
              <ProductImage
                src={product.image}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{product.name}</p>
                {product.is_available ? (
                  product.variant_name && (
                    <p className="text-xs text-muted">
                      {t('offers.size', { size: product.variant_name })}
                    </p>
                  )
                ) : (
                  <p className="text-xs text-danger">{t('offers.dishUnavailable')}</p>
                )}
              </div>
              {count > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => onChange(product.id, -1)}
                    aria-label={t('offers.removeOne', { name: product.name })}
                    className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-surface-raised"
                  >
                    <Minus aria-hidden className="size-4" />
                  </button>
                  <span className="min-w-5 text-center tabular-nums">{count}</span>
                </>
              )}
              <button
                type="button"
                onClick={() => onChange(product.id, 1)}
                disabled={full || !product.is_available}
                aria-label={t('offers.addOne', { name: product.name })}
                className="flex size-9 items-center justify-center rounded-full border border-border text-foreground hover:bg-surface-raised disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Plus aria-hidden className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
