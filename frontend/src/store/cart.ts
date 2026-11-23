/**
 * Cart state (Zustand), persisted in localStorage so it survives reloads and
 * language changes. It stores identifiers plus display snapshots; prices are
 * estimates in integer centimes and are re-validated by the backend.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/** Mirrors the backend limits (ORDER_MAX_ITEM_QUANTITY / ORDER_MAX_LINES). */
export const MAX_ITEM_QUANTITY = 50
export const MAX_CART_LINES = 50

/** Dishes picked in one group of an offer (per unit of the offer line). */
export interface CartOfferChoice {
  groupId: number
  groupName: string
  picks: { productId: number; name: string; quantity: number }[]
}

/**
 * A product line (`productId`, with its options) or an offer line (`offerId`,
 * with the dishes picked in each group). Lines saved before offers existed
 * have no `offerId`.
 */
export interface CartLine {
  key: string
  productId: number | null
  offerId?: number | null
  choices?: CartOfferChoice[]
  slug: string
  name: string
  image: string | null
  variantId: number | null
  variantName: string
  addonIds: number[]
  addonNames: string[]
  unitPriceCents: number
  quantity: number
  specialInstructions: string
}

export type NewCartLine = Omit<CartLine, 'key'>

/** Fresh values from the backend quote for one line. */
export type LineSync = Pick<
  CartLine,
  'key' | 'unitPriceCents' | 'name' | 'variantName' | 'addonNames' | 'choices'
>

interface CartState {
  lines: CartLine[]
  /** Set when a quote changed a stored price; not persisted. */
  pricesChanged: boolean
  dismissPriceNotice: () => void
  addItem: (line: NewCartLine) => void
  setQuantity: (key: string, quantity: number) => void
  removeLine: (key: string) => void
  /**
   * Replace a line after its options were edited. The line keeps its place; if the
   * new options match another line, the two are merged.
   */
  replaceLine: (key: string, line: NewCartLine) => void
  /** Apply authoritative prices and names (in the current language) from a quote. */
  syncLines: (updates: LineSync[]) => void
  clear: () => void
}

/** Product ids picked per group, each id repeated as many times as it was picked. */
export function expandChoices(choices: CartOfferChoice[] = []) {
  return choices.map((choice) => ({
    group: choice.groupId,
    products: choice.picks.flatMap((pick) =>
      Array.from({ length: pick.quantity }, () => pick.productId),
    ),
  }))
}

export const isOfferLine = (line: Pick<CartLine, 'offerId'>) => line.offerId != null

/** Same product + same options + same instructions = same line (same offer + same picks for offers). */
export function cartLineKey(
  line: Pick<
    NewCartLine,
    'productId' | 'variantId' | 'addonIds' | 'specialInstructions' | 'offerId' | 'choices'
  >,
) {
  if (isOfferLine(line)) {
    const picks = expandChoices(line.choices)
      .map(({ group, products }) => `${group}:${[...products].sort((a, b) => a - b).join(',')}`)
      .join(';')
    return ['offer', line.offerId, picks, line.specialInstructions.trim()].join('|')
  }
  const addons = [...line.addonIds].sort((a, b) => a - b).join(',')
  return [line.productId, line.variantId ?? '', addons, line.specialInstructions.trim()].join('|')
}

const clampQuantity = (quantity: number) =>
  Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.trunc(quantity)))

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      pricesChanged: false,
      dismissPriceNotice: () => set({ pricesChanged: false }),
      addItem: (input) =>
        set((state) => {
          const line = { ...input, specialInstructions: input.specialInstructions.trim() }
          const key = cartLineKey(line)
          const existing = state.lines.find((item) => item.key === key)
          if (existing) {
            return {
              lines: state.lines.map((item) =>
                item.key === key
                  ? {
                      ...item,
                      ...line,
                      key,
                      quantity: clampQuantity(item.quantity + line.quantity),
                    }
                  : item,
              ),
            }
          }
          if (state.lines.length >= MAX_CART_LINES) return state
          return {
            lines: [...state.lines, { ...line, key, quantity: clampQuantity(line.quantity) }],
          }
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines.map((item) =>
            item.key === key ? { ...item, quantity: clampQuantity(quantity) } : item,
          ),
        })),
      removeLine: (key) =>
        set((state) => ({ lines: state.lines.filter((item) => item.key !== key) })),
      replaceLine: (oldKey, input) =>
        set((state) => {
          const index = state.lines.findIndex((item) => item.key === oldKey)
          if (index === -1) return state
          const line = { ...input, specialInstructions: input.specialInstructions.trim() }
          const key = cartLineKey(line)
          const quantity = clampQuantity(line.quantity)
          const twin = key === oldKey ? undefined : state.lines.find((item) => item.key === key)
          if (twin) {
            return {
              lines: state.lines
                .filter((item) => item.key !== oldKey)
                .map((item) =>
                  item.key === key
                    ? { ...item, ...line, key, quantity: clampQuantity(item.quantity + quantity) }
                    : item,
                ),
            }
          }
          const lines = [...state.lines]
          lines[index] = { ...line, key, quantity }
          return { lines }
        }),
      syncLines: (updates) =>
        set((state) => {
          const byKey = new Map(updates.map((update) => [update.key, update]))
          let changed = false
          let priceChanged = false
          const lines = state.lines.map((line) => {
            const update = byKey.get(line.key)
            if (
              !update ||
              (update.unitPriceCents === line.unitPriceCents &&
                update.name === line.name &&
                update.variantName === line.variantName &&
                update.addonNames.join('|') === line.addonNames.join('|') &&
                JSON.stringify(update.choices ?? null) === JSON.stringify(line.choices ?? null))
            ) {
              return line
            }
            changed = true
            if (update.unitPriceCents !== line.unitPriceCents) priceChanged = true
            return { ...line, ...update }
          })
          if (!changed) return state
          return priceChanged ? { lines, pricesChanged: true } : { lines }
        }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'restoflow.cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
)

export const selectItemCount = (state: CartState) =>
  state.lines.reduce((count, line) => count + line.quantity, 0)

export const selectSubtotalCents = (state: CartState) =>
  state.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0)
