import { beforeEach, describe, expect, it } from 'vitest'

import { estimateUnitPrice } from '@/features/cart/pricing'
import { burgerDetail } from '@/test/fixtures'

import {
  cartLineKey,
  MAX_ITEM_QUANTITY,
  selectItemCount,
  selectSubtotalCents,
  useCartStore,
  type NewCartLine,
} from './cart'

const line = (overrides: Partial<NewCartLine> = {}): NewCartLine => ({
  productId: 10,
  slug: 'double-cheese',
  name: 'Double Cheese',
  image: null,
  variantId: 100,
  variantName: 'Simple',
  addonIds: [],
  addonNames: [],
  unitPriceCents: 6500,
  quantity: 1,
  specialInstructions: '',
  ...overrides,
})

const state = () => useCartStore.getState()

function lineKey(index = 0): string {
  const key = state().lines[index]?.key
  if (!key) throw new Error(`No cart line at index ${index}`)
  return key
}

describe('cart store', () => {
  beforeEach(() => useCartStore.setState({ lines: [] }))

  it('adds a product and computes count and subtotal', () => {
    state().addItem(line({ quantity: 2 }))
    state().addItem(line({ productId: 20, slug: 'tea', variantId: null, unitPriceCents: 1500 }))

    expect(state().lines).toHaveLength(2)
    expect(selectItemCount(state())).toBe(3)
    expect(selectSubtotalCents(state())).toBe(2 * 6500 + 1500)
  })

  it('merges identical lines, whatever the add-on order', () => {
    state().addItem(line({ addonIds: [1, 2] }))
    state().addItem(line({ addonIds: [2, 1], quantity: 2 }))

    expect(state().lines).toHaveLength(1)
    expect(state().lines[0]?.quantity).toBe(3)
  })

  it('keeps different options and instructions on separate lines', () => {
    state().addItem(line())
    state().addItem(line({ variantId: 101 }))
    state().addItem(line({ specialInstructions: 'Sans oignons' }))

    expect(state().lines).toHaveLength(3)
  })

  it('updates and clamps quantities', () => {
    state().addItem(line())
    const key = lineKey()

    state().setQuantity(key, 4)
    expect(state().lines[0]?.quantity).toBe(4)
    state().setQuantity(key, 0)
    expect(state().lines[0]?.quantity).toBe(1)
    state().setQuantity(key, 999)
    expect(state().lines[0]?.quantity).toBe(MAX_ITEM_QUANTITY)
  })

  it('removes lines and clears the cart', () => {
    state().addItem(line())
    state().addItem(line({ productId: 20 }))
    state().removeLine(lineKey())
    expect(state().lines).toHaveLength(1)

    state().clear()
    expect(state().lines).toEqual([])
  })

  it('persists to localStorage', () => {
    state().addItem(line())

    const saved = JSON.parse(window.localStorage.getItem('restoflow.cart') ?? '{}')
    expect(saved.state.lines[0].productId).toBe(10)
  })

  it('builds stable line keys', () => {
    expect(cartLineKey(line({ addonIds: [3, 1], specialInstructions: ' x ' }))).toBe(
      cartLineKey(line({ addonIds: [1, 3], specialInstructions: 'x' })),
    )
  })
})

describe('estimateUnitPrice', () => {
  it('adds variant and add-on prices to the effective price', () => {
    const xl = burgerDetail.variants.find((variant) => variant.name === 'XL') ?? null
    expect(estimateUnitPrice(burgerDetail, xl, burgerDetail.addons)).toBe(6500 + 2000 + 800 + 1250)
    expect(estimateUnitPrice(burgerDetail, null, [])).toBe(6500)
  })
})
