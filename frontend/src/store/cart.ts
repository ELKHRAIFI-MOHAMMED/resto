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

export interface CartLine {
  key: string
  productId: number
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
  'key' | 'unitPriceCents' | 'name' | 'variantName' | 'addonNames'
>

interface CartState {
  lines: CartLine[]
  /** Set when a quote changed a stored price; not persisted. */
  pricesChanged: boolean
  dismissPriceNotice: () => void
  addItem: (line: NewCartLine) => void
  setQuantity: (key: string, quantity: number) => void
  removeLine: (key: string) => void
  /** Apply authoritative prices and names (in the current language) from a quote. */
  syncLines: (updates: LineSync[]) => void
  clear: () => void
}

/** Same product + same options + same instructions = same line. */
export function cartLineKey(
  line: Pick<NewCartLine, 'productId' | 'variantId' | 'addonIds' | 'specialInstructions'>,
) {
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
                update.addonNames.join('|') === line.addonNames.join('|'))
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
