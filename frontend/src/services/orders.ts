import { apiFetch } from '@/services/api'
import { expandChoices, isOfferLine, type CartLine } from '@/store/cart'
import type {
  CreatedOrder,
  CreateOrderRequest,
  OrderItemInput,
  Quote,
  QuoteRequest,
} from '@/types/orders'

/** The API only receives identifiers and quantities: never prices. */
export function toOrderItems(lines: CartLine[]): OrderItemInput[] {
  return lines.map((line) =>
    isOfferLine(line)
      ? {
          offer: line.offerId as number,
          choices: expandChoices(line.choices),
          quantity: line.quantity,
          special_instructions: line.specialInstructions,
        }
      : {
          product: line.productId as number,
          variant: line.variantId,
          addons: line.addonIds,
          quantity: line.quantity,
          special_instructions: line.specialInstructions,
        },
  )
}

export function quoteOrder(request: QuoteRequest, signal?: AbortSignal) {
  return apiFetch<Quote>('/orders/quote/', { method: 'POST', body: request, signal })
}

export function createOrder(request: CreateOrderRequest) {
  return apiFetch<CreatedOrder>('/orders/', { method: 'POST', body: request })
}
