/**
 * The last order placed from this browser, kept so the customer can reopen
 * WhatsApp (or copy the message) if the hand-off failed, even after a reload.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { CreatedOrder } from '@/types/orders'

const KEEP_FOR_MS = 24 * 60 * 60 * 1000

interface LastOrderState {
  order: CreatedOrder | null
  savedAt: number | null
  /** Whether the customer already tapped "Open WhatsApp" for this order. */
  handoffStarted: boolean
  save: (order: CreatedOrder) => void
  markHandoffStarted: () => void
  forget: () => void
}

export const useLastOrderStore = create<LastOrderState>()(
  persist(
    (set) => ({
      order: null,
      savedAt: null,
      handoffStarted: false,
      save: (order) => set({ order, savedAt: Date.now(), handoffStarted: false }),
      markHandoffStarted: () => set({ handoffStarted: true }),
      forget: () => set({ order: null, savedAt: null, handoffStarted: false }),
    }),
    {
      name: 'restoflow.last-order',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Old hand-offs are dropped: the restaurant has long handled the order.
      onRehydrateStorage: () => (state) => {
        if (state?.savedAt && Date.now() - state.savedAt > KEEP_FOR_MS) state.forget()
      },
    },
  ),
)

/** A pending checkout attempt token, reused across retries of the same attempt. */
export function newClientToken(): string {
  return crypto.randomUUID()
}
