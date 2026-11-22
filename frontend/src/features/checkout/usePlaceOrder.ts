import { useMutation } from '@tanstack/react-query'
import { useRef } from 'react'
import { useNavigate } from 'react-router'

import { createOrder } from '@/services/orders'
import { useCartStore } from '@/store/cart'
import { newClientToken, useLastOrderStore } from '@/store/lastOrder'
import type { CreateOrderRequest } from '@/types/orders'

import { buildWhatsAppUrl, prefersSameTabHandoff } from './whatsapp'

export interface OrderPageState {
  /** Ask the order page to hand off to WhatsApp in this tab (phones). */
  autoOpen?: boolean
}

/**
 * Saves the order, then hands off to WhatsApp. The order is always saved
 * first; WhatsApp only opens once the backend returned the reference and the
 * message. Nothing here marks the order as sent or confirmed.
 */
export function usePlaceOrder() {
  const navigate = useNavigate()
  const clearCart = useCartStore((state) => state.clear)
  const saveOrder = useLastOrderStore((state) => state.save)
  const markHandoffStarted = useLastOrderStore((state) => state.markHandoffStarted)
  // One token per checkout attempt: retries after a dropped connection return
  // the order already saved instead of creating a duplicate.
  const clientToken = useRef(newClientToken())

  const mutation = useMutation({ mutationFn: createOrder })

  const placeOrder = (
    request: Omit<CreateOrderRequest, 'client_token'>,
    { onError }: { onError?: (error: unknown) => void } = {},
  ) => {
    const sameTab = prefersSameTabHandoff()
    // Desktop: open the tab now, inside the click, or the browser blocks it.
    const handoffWindow = sameTab ? null : window.open('', '_blank')
    if (handoffWindow) handoffWindow.opener = null

    mutation.mutate(
      { ...request, client_token: clientToken.current },
      {
        onSuccess: (order) => {
          saveOrder(order)
          if (handoffWindow) {
            handoffWindow.location.href = buildWhatsAppUrl(
              order.whatsapp.phone,
              order.whatsapp.message,
            )
            markHandoffStarted()
          }
          const state: OrderPageState = { autoOpen: sameTab }
          navigate(`/order/${encodeURIComponent(order.reference)}`, { state })
          clearCart()
        },
        onError: (error) => {
          handoffWindow?.close()
          onError?.(error)
        },
      },
    )
  }

  return { placeOrder, ...mutation }
}
